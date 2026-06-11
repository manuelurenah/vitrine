import 'server-only';
import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  campaignTiles as campaignTilesTable,
  campaigns as campaignsTable,
  tileVersions as tileVersionsTable,
  type TileVersion as TileVersionRow,
} from '@/lib/db/schema';
import type { AdCopy } from './adCopy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TileVersionSnapshot = {
  version: number;
  prompt: string;
  adCopy: { headline: string; subhead: string; cta?: string } | null;
};

export type TileFieldDiff = {
  field: 'headline' | 'subhead' | 'cta' | 'prompt';
  changed: boolean;
  old: string;
  next: string;
};

export type TileVersionEntry = {
  id: string;
  version: number;
  workflowId: string;
  prompt: string;
  adCopy: AdCopy | null;
  assetId: string | null;
  changeNote: string | null;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compares two tile version snapshots field-by-field and returns one diff
 * entry per field in the order: headline, subhead, cta, prompt.
 */
export function diffTileVersions(
  prev: TileVersionSnapshot,
  next: TileVersionSnapshot,
): TileFieldDiff[] {
  const fields = ['headline', 'subhead', 'cta', 'prompt'] as const;

  return fields.map((field) => {
    let oldVal: string;
    let nextVal: string;

    if (field === 'prompt') {
      oldVal = prev.prompt;
      nextVal = next.prompt;
    } else {
      oldVal = prev.adCopy?.[field] ?? '';
      nextVal = next.adCopy?.[field] ?? '';
    }

    return {
      field,
      changed: oldVal !== nextVal,
      old: oldVal,
      next: nextVal,
    };
  });
}

// ---------------------------------------------------------------------------
// Minimal structural type that covers both db and a drizzle transaction
// ---------------------------------------------------------------------------
type DbLike = Pick<typeof db, 'select' | 'insert'>;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function toTileVersionEntry(row: TileVersionRow): TileVersionEntry {
  return {
    id: row.id,
    version: row.version,
    workflowId: row.workflowId,
    prompt: row.prompt,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    assetId: row.assetId ?? null,
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
  assetId?: string | null;
  changeNote?: string;
  generationId?: string | null;
};

/**
 * Inserts a new version row for the given tile. The version number is
 * computed as max(version) + 1 for the tile, defaulting to 1 on first insert.
 *
 * `executor` may be the `db` client or a drizzle transaction.
 */
export async function recordTileVersion(
  executor: DbLike,
  input: RecordTileVersionInput,
): Promise<number> {
  const version = await nextVersionNumber(executor, input.tileId);

  await executor.insert(tileVersionsTable).values({
    tileId: input.tileId,
    version,
    workflowId: input.workflowId,
    prompt: input.prompt,
    adCopy: input.adCopy ?? null,
    assetId: input.assetId ?? null,
    changeNote: input.changeNote ?? null,
    generationId: input.generationId ?? null,
  });

  return version;
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

  return rows.map((r) =>
    toTileVersionEntry({
      ...r,
      tileId,
      generationId: r.generationId ?? null,
    } as TileVersionRow),
  );
}
