import 'server-only';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets as assetsTable,
  type Campaign as CampaignRow,
  type CampaignTile as CampaignTileRow,
  campaigns as campaignsTable,
  campaignTiles as campaignTilesTable,
} from '@/lib/db/schema';

export type CampaignSummary = {
  id: string;
  title: string;
  createdAt: number;
  thumbUrl: string | null;
};
import type { AdCopy } from './adCopy';
import type { BriefForPresets, PresetId } from './presets';
import { recordTileVersion } from './tileVersions';

export type TileStatus = 'queued' | 'cooking' | 'done' | 'failed';

export type CampaignTile = {
  id: string;
  presetId: PresetId;
  workflowId: string;
  status: TileStatus;
  prompt: string;
  quantity: number;
  variantGroupId: string | null;
  variantIndex: number;
  adCopy: AdCopy | null;
  assetUrl: string | null;
};

export type Campaign = {
  id: string;
  userId: string;
  title: string;
  brief: BriefForPresets;
  presetIds: PresetId[];
  referenceAssetIds: string[];
  variantsPerPreset: number;
  enhancedPrompts: Record<string, unknown> | null;
  tiles: CampaignTile[];
  // First available done-tile image, used as a list/grid thumbnail. Null until
  // at least one tile finishes with a linked asset.
  thumbUrl: string | null;
  estimatedBuzz: number;
  audience: string | null;
  aesthetics: string | null;
  createdAt: number;
};

function toTile(row: CampaignTileRow, assetUrl?: string | null): CampaignTile {
  return {
    id: row.id,
    presetId: row.presetId as PresetId,
    workflowId: row.workflowId,
    status: row.status,
    prompt: row.prompt,
    quantity: row.quantity,
    variantGroupId: row.variantGroupId ?? null,
    variantIndex: row.variantIndex,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    assetUrl: assetUrl ?? null,
  };
}

function toCampaign(
  row: CampaignRow,
  tiles: CampaignTileRow[],
  assetUrlByTileId: Map<string, string> = new Map(),
): Campaign {
  const mappedTiles = tiles.map((t) => toTile(t, assetUrlByTileId.get(t.id)));
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    brief: row.brief as BriefForPresets,
    presetIds: row.presetIds as PresetId[],
    referenceAssetIds: row.referenceAssetIds,
    variantsPerPreset: row.variantsPerPreset,
    enhancedPrompts: (row.enhancedPrompts as Record<string, unknown> | null) ?? null,
    tiles: mappedTiles,
    thumbUrl: mappedTiles.find((t) => t.assetUrl)?.assetUrl ?? null,
    estimatedBuzz: row.estimatedBuzz,
    audience: row.audience,
    aesthetics: row.aesthetics,
    createdAt: row.createdAt.getTime(),
  };
}

export type CreateCampaignInput = {
  userId: string;
  title: string;
  brief: BriefForPresets;
  presetIds: PresetId[];
  tiles: Array<{
    presetId: PresetId;
    workflowId: string;
    prompt: string;
    quantity?: number;
    variantGroupId?: string | null;
    variantIndex?: number;
    adCopy?: AdCopy | null;
  }>;
  estimatedBuzz: number;
  audience?: string | null;
  aesthetics?: string | null;
  referenceAssetIds?: string[];
  variantsPerPreset?: number;
  enhancedPrompts?: Record<string, unknown> | null;
};

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return db.transaction(async (tx) => {
    const [campaignRow] = await tx
      .insert(campaignsTable)
      .values({
        userId: input.userId,
        title: input.title,
        brief: input.brief,
        presetIds: input.presetIds,
        referenceAssetIds: input.referenceAssetIds ?? [],
        variantsPerPreset: input.variantsPerPreset ?? 1,
        enhancedPrompts: input.enhancedPrompts ?? null,
        estimatedBuzz: input.estimatedBuzz,
        audience: input.audience ?? null,
        aesthetics: input.aesthetics ?? null,
      })
      .returning();
    if (!campaignRow) throw new Error('campaign insert returned no row');

    const tileRows = input.tiles.length
      ? await tx
          .insert(campaignTilesTable)
          .values(
            input.tiles.map((t) => ({
              campaignId: campaignRow.id,
              presetId: t.presetId,
              workflowId: t.workflowId,
              prompt: t.prompt,
              quantity: t.quantity ?? 1,
              variantGroupId: t.variantGroupId ?? null,
              variantIndex: t.variantIndex ?? 0,
              status: 'cooking' as TileStatus,
              adCopy: t.adCopy ?? null,
            })),
          )
          .returning()
      : [];

    // Record version 1 for every newly inserted tile.
    for (let i = 0; i < tileRows.length; i++) {
      const tileRow = tileRows[i];
      const tileInput = input.tiles[i];
      if (tileRow && tileInput) {
        await recordTileVersion(tx, {
          tileId: tileRow.id,
          workflowId: tileInput.workflowId,
          prompt: tileInput.prompt,
          adCopy: tileInput.adCopy ?? null,
          changeNote: 'cooked',
        });
      }
    }

    return toCampaign(campaignRow, tileRows);
  });
}

async function loadCampaign(userId: string, id: string): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .limit(1);
  if (!row) return null;
  const tileRows = await db
    .select()
    .from(campaignTilesTable)
    .where(eq(campaignTilesTable.campaignId, row.id))
    .orderBy(campaignTilesTable.createdAt);

  // Build a tileId → publicUrl map for tiles that already have a linked asset.
  const assetUrlByTileId = new Map<string, string>();
  const tileIdsWithAsset = tileRows
    .filter((t) => t.assetId !== null)
    .map((t) => t.assetId as string);
  if (tileIdsWithAsset.length > 0) {
    const assetRows = await db
      .select({ id: assetsTable.id, publicUrl: assetsTable.publicUrl })
      .from(assetsTable)
      .where(and(inArray(assetsTable.id, tileIdsWithAsset), isNull(assetsTable.deletedAt)));
    const urlById = new Map(assetRows.map((a) => [a.id, a.publicUrl]));
    for (const t of tileRows) {
      if (t.assetId) {
        const url = urlById.get(t.assetId);
        if (url) assetUrlByTileId.set(t.id, url);
      }
    }
  }

  return toCampaign(row, tileRows, assetUrlByTileId);
}

export function getCampaign(userId: string, id: string): Promise<Campaign | null> {
  return loadCampaign(userId, id);
}

export async function listCampaigns(userId: string): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId))
    .orderBy(desc(campaignsTable.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tiles = await db
    .select()
    .from(campaignTilesTable)
    .where(inArray(campaignTilesTable.campaignId, ids))
    .orderBy(campaignTilesTable.createdAt);

  const byCampaign = new Map<string, CampaignTileRow[]>();
  for (const t of tiles) {
    const bucket = byCampaign.get(t.campaignId) ?? [];
    bucket.push(t);
    byCampaign.set(t.campaignId, bucket);
  }

  // Resolve thumbnails: one query for the public URLs of every done tile that
  // has a linked, non-deleted asset. `toCampaign` derives each campaign's
  // `thumbUrl` from the first tile (in createdAt order) that has an assetUrl.
  const assetUrlByTileId = new Map<string, string>();
  const tilesWithAsset = tiles.filter((t) => t.assetId !== null);
  if (tilesWithAsset.length > 0) {
    const assetRows = await db
      .select({ id: assetsTable.id, publicUrl: assetsTable.publicUrl })
      .from(assetsTable)
      .where(
        and(
          inArray(
            assetsTable.id,
            tilesWithAsset.map((t) => t.assetId as string),
          ),
          isNull(assetsTable.deletedAt),
        ),
      );
    const urlById = new Map(assetRows.map((a) => [a.id, a.publicUrl]));
    for (const t of tilesWithAsset) {
      const url = urlById.get(t.assetId as string);
      if (url) assetUrlByTileId.set(t.id, url);
    }
  }

  return rows.map((r) => toCampaign(r, byCampaign.get(r.id) ?? [], assetUrlByTileId));
}

/**
 * Hard-delete a campaign the user owns. Cascades to `campaignTiles` (and their
 * `tileVersions`) via FK `onDelete: 'cascade'`. Generations and buzz events are
 * user-scoped audit rows and intentionally survive; linked assets stay in the
 * user's library (the tile→asset FK is `set null`, but the tile is removed). No-op
 * returning `false` if the campaign doesn't exist or belongs to another user.
 */
export async function deleteCampaign(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning({ id: campaignsTable.id });
  return result.length > 0;
}

/**
 * Update a campaign's editable header fields. Ownership-scoped: returns `null`
 * if the campaign doesn't exist or belongs to another user. `title` is a column;
 * `description` lives inside the `brief` jsonb, so it's merged onto the existing
 * brief (read-modify-write). Only the keys present in `patch` are touched.
 */
export async function updateCampaign(
  userId: string,
  id: string,
  patch: { title?: string; description?: string },
): Promise<Campaign | null> {
  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) {
    const brief = existing.brief as BriefForPresets;
    update.brief = { ...brief, description: patch.description };
  }

  await db
    .update(campaignsTable)
    .set(update)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)));

  return loadCampaign(userId, id);
}

export async function updateTileStatus(
  userId: string,
  campaignId: string,
  tileId: string,
  status: TileStatus,
): Promise<Campaign | null> {
  const campaign = await loadCampaign(userId, campaignId);
  if (!campaign) return null;
  await db
    .update(campaignTilesTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(campaignTilesTable.id, tileId), eq(campaignTilesTable.campaignId, campaignId)));
  return loadCampaign(userId, campaignId);
}

export type CampaignAssetEntry = {
  tileId: string;
  presetId: string;
  publicUrl: string;
  contentType: string | null;
};

export async function listCampaignAssets(
  userId: string,
  campaignId: string,
): Promise<CampaignAssetEntry[]> {
  const rows = await db
    .select({
      tileId: campaignTilesTable.id,
      presetId: campaignTilesTable.presetId,
      publicUrl: assetsTable.publicUrl,
      contentType: assetsTable.contentType,
    })
    .from(campaignTilesTable)
    .innerJoin(campaignsTable, eq(campaignsTable.id, campaignTilesTable.campaignId))
    .innerJoin(assetsTable, eq(assetsTable.id, campaignTilesTable.assetId))
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.userId, userId),
        eq(campaignTilesTable.status, 'done'),
        isNull(assetsTable.deletedAt),
      ),
    );
  return rows.filter(
    (r): r is { tileId: string; presetId: string; publicUrl: string; contentType: string | null } =>
      Boolean(r.publicUrl),
  );
}

export async function updateTileFields(
  userId: string,
  campaignId: string,
  tileId: string,
  patch: { adCopy?: AdCopy; prompt?: string },
): Promise<CampaignTile | null> {
  const owner = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.userId, userId)))
    .limit(1);
  if (owner.length === 0) return null;

  const [existing] = await db
    .select()
    .from(campaignTilesTable)
    .where(and(eq(campaignTilesTable.id, tileId), eq(campaignTilesTable.campaignId, campaignId)))
    .limit(1);
  if (!existing) return null;

  return db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.adCopy !== undefined) update.adCopy = patch.adCopy;
    if (patch.prompt !== undefined) update.prompt = patch.prompt;

    const [row] = await tx
      .update(campaignTilesTable)
      .set(update)
      .where(and(eq(campaignTilesTable.id, tileId), eq(campaignTilesTable.campaignId, campaignId)))
      .returning();

    if (!row) return null;

    await recordTileVersion(tx, {
      tileId: row.id,
      workflowId: row.workflowId,
      prompt: row.prompt,
      adCopy: row.adCopy ?? null,
      changeNote: 'edited',
    });

    return toTile(row);
  });
}

export async function listCampaignsUsingProduct(
  userId: string,
  productId: string,
): Promise<CampaignSummary[]> {
  // Load campaigns where productId matches and owned by userId.
  const rows = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.userId, userId), eq(campaignsTable.productId, productId)))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(24);

  if (rows.length === 0) return [];

  // Fetch one "done" tile asset per campaign for a thumbnail.
  const ids = rows.map((r) => r.id);
  const thumbRows = await db
    .select({
      campaignId: campaignTilesTable.campaignId,
      publicUrl: assetsTable.publicUrl,
    })
    .from(campaignTilesTable)
    .innerJoin(assetsTable, eq(assetsTable.id, campaignTilesTable.assetId))
    .where(
      and(
        inArray(campaignTilesTable.campaignId, ids),
        eq(campaignTilesTable.status, 'done'),
        isNull(assetsTable.deletedAt),
      ),
    )
    .limit(ids.length * 4);

  // Keep only the first thumb per campaign.
  const thumbByCampaign = new Map<string, string>();
  for (const t of thumbRows) {
    if (t.publicUrl && !thumbByCampaign.has(t.campaignId)) {
      thumbByCampaign.set(t.campaignId, t.publicUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.getTime(),
    thumbUrl: thumbByCampaign.get(r.id) ?? null,
  }));
}

export async function swapTileWorkflow(
  userId: string,
  campaignId: string,
  tileId: string,
  newWorkflowId: string,
  options?: { prompt?: string; adCopy?: AdCopy | null },
): Promise<CampaignTile | null> {
  // Make sure the campaign belongs to the user before mutating any tile.
  const owner = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.userId, userId)))
    .limit(1);
  if (owner.length === 0) return null;

  const update: Record<string, unknown> = {
    workflowId: newWorkflowId,
    status: 'cooking',
    updatedAt: new Date(),
  };
  if (options?.prompt !== undefined) update.prompt = options.prompt;
  if (options?.adCopy !== undefined) update.adCopy = options.adCopy;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(campaignTilesTable)
      .set(update)
      .where(and(eq(campaignTilesTable.id, tileId), eq(campaignTilesTable.campaignId, campaignId)))
      .returning();

    if (row) {
      await recordTileVersion(tx, {
        tileId: row.id,
        workflowId: newWorkflowId,
        prompt: row.prompt,
        adCopy: row.adCopy ?? null,
        changeNote: 'regenerated',
      });
    }

    return row ? toTile(row) : null;
  });
}
