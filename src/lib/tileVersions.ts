import 'server-only';
import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets as assetsTable,
  campaignTiles as campaignTilesTable,
  campaigns as campaignsTable,
  tileVersions as tileVersionsTable,
  type TileVersion as TileVersionRow,
} from '@/lib/db/schema';
import type { AdCopy } from './adCopy';
import type { TileVersionEntry } from './tileVersionsDiff';

// Re-export the client-safe types + pure helpers so existing importers of
// `@/lib/tileVersions` keep working. The pure logic itself lives in
// `tileVersionsDiff.ts` (no server-only / db deps) so client components can
// import it without dragging `pg` into the browser bundle.
export {
  diffTileVersions,
  type TileFieldDiff,
  type TileVersionEntry,
  type TileVersionSnapshot,
} from './tileVersionsDiff';

// ---------------------------------------------------------------------------
// Minimal structural type that covers both db and a drizzle transaction
// ---------------------------------------------------------------------------
type DbLike = Pick<typeof db, 'select' | 'insert'>;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function toTileVersionEntry(row: TileVersionRow, assetUrl: string | null = null): TileVersionEntry {
  return {
    id: row.id,
    version: row.version,
    workflowId: row.workflowId,
    prompt: row.prompt,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    palette: (row.palette as string[] | null) ?? null,
    assetId: row.assetId ?? null,
    assetUrl,
    changeNote: row.changeNote ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

export async function nextVersionNumber(executor: DbLike, tileId: string): Promise<number> {
  const [result] = await executor
    .select({ maxVersion: max(tileVersionsTable.version) })
    .from(tileVersionsTable)
    .where(eq(tileVersionsTable.tileId, tileId));

  const current = result?.maxVersion ?? null;
  return current === null ? 1 : current + 1;
}

export type RecordTileVersionInput = {
  tileId: string;
  workflowId: string;
  prompt: string;
  adCopy?: unknown;
  palette?: string[] | null;
  assetId?: string | null;
  changeNote?: string;
  generationId?: string | null;
};

/**
 * Inserts a new version row for the given tile. The version number is
 * computed as max(version) + 1 for the tile, defaulting to 1 on first insert.
 *
 * `executor` may be the `db` client or a drizzle transaction.
 *
 * Concurrent regenerations of the same tile can race and both compute the same
 * version number. On a unique-constraint violation (pg code 23505) we recompute
 * the next version and retry up to 3 times total before rethrowing.
 */
export async function recordTileVersion(
  executor: DbLike,
  input: RecordTileVersionInput,
): Promise<number> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const version = await nextVersionNumber(executor, input.tileId);

    try {
      await executor.insert(tileVersionsTable).values({
        tileId: input.tileId,
        version,
        workflowId: input.workflowId,
        prompt: input.prompt,
        adCopy: input.adCopy ?? null,
        palette: input.palette ?? null,
        assetId: input.assetId ?? null,
        changeNote: input.changeNote ?? null,
        generationId: input.generationId ?? null,
      });

      return version;
    } catch (err) {
      const isUniqueViolation =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === '23505';

      if (!isUniqueViolation || attempt === maxAttempts) {
        throw err;
      }
      // Unique-constraint race: recompute version on next iteration.
    }
  }

  // Unreachable — the loop always returns or throws, but TypeScript needs this.
  throw new Error('recordTileVersion: exhausted retry attempts');
}

/**
 * Returns all versions for a tile, verified against ownership via userId +
 * campaignId join.  Ordered by version ascending.
 */
export async function listTileVersions(
  userId: string,
  campaignId: string,
  tileId: string,
): Promise<TileVersionEntry[]> {
  const rows = await db
    .select({
      id: tileVersionsTable.id,
      version: tileVersionsTable.version,
      workflowId: tileVersionsTable.workflowId,
      prompt: tileVersionsTable.prompt,
      adCopy: tileVersionsTable.adCopy,
      palette: tileVersionsTable.palette,
      assetId: tileVersionsTable.assetId,
      changeNote: tileVersionsTable.changeNote,
      generationId: tileVersionsTable.generationId,
      createdAt: tileVersionsTable.createdAt,
    })
    .from(tileVersionsTable)
    .innerJoin(campaignTilesTable, eq(campaignTilesTable.id, tileVersionsTable.tileId))
    .innerJoin(campaignsTable, eq(campaignsTable.id, campaignTilesTable.campaignId))
    .where(
      and(
        eq(campaignsTable.userId, userId),
        eq(campaignsTable.id, campaignId),
        eq(tileVersionsTable.tileId, tileId),
      ),
    )
    .orderBy(asc(tileVersionsTable.version));

  // Resolve one public URL per distinct workflowId (the first generated image).
  const workflowIds = [...new Set(rows.map((r) => r.workflowId))];
  const urlByWorkflow = new Map<string, string>();
  if (workflowIds.length > 0) {
    const assetRows = await db
      .select({
        workflowId: assetsTable.workflowId,
        storageKey: assetsTable.storageKey,
        publicUrl: assetsTable.publicUrl,
      })
      .from(assetsTable)
      .where(and(inArray(assetsTable.workflowId, workflowIds), isNull(assetsTable.deletedAt)))
      .orderBy(asc(assetsTable.storageKey));
    for (const a of assetRows) {
      if (a.workflowId && a.publicUrl && !urlByWorkflow.has(a.workflowId)) {
        urlByWorkflow.set(a.workflowId, a.publicUrl);
      }
    }
  }

  return rows.map((r) =>
    toTileVersionEntry(
      { ...r, tileId, generationId: r.generationId ?? null } as TileVersionRow,
      urlByWorkflow.get(r.workflowId) ?? null,
    ),
  );
}

// ---------------------------------------------------------------------------
// Ownership-checked lookups
// ---------------------------------------------------------------------------

/**
 * Resolves a tile to its owning campaign, returning the tile's mutable fields
 * only when the campaign belongs to `userId` and the tile belongs to that
 * campaign. Returns `null` when ownership fails or the tile does not exist.
 */
async function loadOwnedTile(
  userId: string,
  campaignId: string,
  tileId: string,
): Promise<{ id: string; workflowId: string } | null> {
  const [row] = await db
    .select({ id: campaignTilesTable.id, workflowId: campaignTilesTable.workflowId })
    .from(campaignTilesTable)
    .innerJoin(campaignsTable, eq(campaignsTable.id, campaignTilesTable.campaignId))
    .where(
      and(
        eq(campaignsTable.userId, userId),
        eq(campaignsTable.id, campaignId),
        eq(campaignTilesTable.id, tileId),
      ),
    )
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Restores a tile to a prior version's prompt + adCopy by writing those fields
 * back onto the tile and recording a fresh version that captures the restore.
 *
 * Ownership is checked first. The tile update and the new version insert run in
 * a single transaction so a partial restore can never be observed.
 *
 * Returns a synthetic {@link TileVersionEntry} describing the newly recorded
 * version. The client triggers `router.refresh()` after a restore, so the page
 * re-fetches the authoritative list; the synthetic entry only needs to convey
 * the new version number and the restored content.
 */
export async function restoreTileVersion(
  userId: string,
  campaignId: string,
  tileId: string,
  version: number,
): Promise<TileVersionEntry | null> {
  const tile = await loadOwnedTile(userId, campaignId, tileId);
  if (!tile) return null;

  // The version being restored must exist for this tile.
  const [target] = await db
    .select({
      prompt: tileVersionsTable.prompt,
      adCopy: tileVersionsTable.adCopy,
      palette: tileVersionsTable.palette,
      assetId: tileVersionsTable.assetId,
    })
    .from(tileVersionsTable)
    .where(and(eq(tileVersionsTable.tileId, tileId), eq(tileVersionsTable.version, version)))
    .limit(1);

  if (!target) return null;

  const restoredAdCopy = (target.adCopy as AdCopy | null) ?? null;
  const restoredPalette = (target.palette as string[] | null) ?? null;
  const restoredAssetId = target.assetId ?? null;

  return db.transaction(async (tx) => {
    await tx
      .update(campaignTilesTable)
      .set({
        prompt: target.prompt,
        adCopy: restoredAdCopy,
        palette: restoredPalette,
        assetId: restoredAssetId,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignTilesTable.id, tileId), eq(campaignTilesTable.campaignId, campaignId)));

    const newVersion = await recordTileVersion(tx, {
      tileId: tile.id,
      workflowId: tile.workflowId,
      prompt: target.prompt,
      adCopy: restoredAdCopy,
      palette: restoredPalette,
      assetId: restoredAssetId,
      changeNote: `restored v${version}`,
    });

    return {
      id: `restored-${tile.id}-${newVersion}`,
      version: newVersion,
      workflowId: tile.workflowId,
      prompt: target.prompt,
      adCopy: restoredAdCopy,
      palette: restoredPalette,
      assetId: restoredAssetId,
      assetUrl: null,
      changeNote: `restored v${version}`,
      createdAt: Date.now(),
    } satisfies TileVersionEntry;
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeleteTileVersionResult = { ok: true; version: number } | { ok: false; reason: string };

/**
 * Deletes a single tile version after an ownership check.
 *
 * Refuses (returns `{ ok: false }` with a human-readable reason) when:
 *  - ownership fails or the version does not exist,
 *  - it is the only remaining version for the tile,
 *  - it is the current (latest) version — deleting it would orphan the tile's
 *    live state from its history.
 */
export async function deleteTileVersion(
  userId: string,
  campaignId: string,
  tileId: string,
  version: number,
): Promise<DeleteTileVersionResult> {
  const tile = await loadOwnedTile(userId, campaignId, tileId);
  if (!tile) return { ok: false, reason: 'version not found' };

  const versions = await db
    .select({ version: tileVersionsTable.version })
    .from(tileVersionsTable)
    .where(eq(tileVersionsTable.tileId, tileId))
    .orderBy(desc(tileVersionsTable.version));

  const exists = versions.some((v) => v.version === version);
  if (!exists) return { ok: false, reason: 'version not found' };

  if (versions.length <= 1) {
    return { ok: false, reason: "can't delete the only version" };
  }

  const latest = versions[0]?.version;
  if (latest === version) {
    return { ok: false, reason: "can't delete the current version" };
  }

  await db
    .delete(tileVersionsTable)
    .where(and(eq(tileVersionsTable.tileId, tileId), eq(tileVersionsTable.version, version)));

  return { ok: true, version };
}
