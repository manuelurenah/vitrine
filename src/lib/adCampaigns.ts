import 'server-only';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  adCampaigns as adCampaignsTable,
  adCampaignTiles as adCampaignTilesTable,
  type AdCampaign as AdCampaignRow,
  type AdCampaignTile as AdCampaignTileRow,
  assets as assetsTable,
} from '@/lib/db/schema';
import type { AdCopy } from './adCopy';
import type { BriefForPresets } from './presets';
import type { AspectRatio } from './promptBuilder';

export type AdTileStatus = 'queued' | 'cooking' | 'done' | 'failed';

export type AdCampaignTile = {
  id: string;
  sizeId: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  workflowId: string;
  status: AdTileStatus;
  prompt: string;
  quantity: number;
  adCopy: AdCopy | null;
  assetUrl: string | null;
};

export type AdCampaign = {
  id: string;
  userId: string;
  title: string;
  brief: BriefForPresets;
  sizeIds: string[];
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  adCopy: AdCopy | null;
  tiles: AdCampaignTile[];
  // First available done-tile image, used as a list/grid thumbnail. Null until
  // at least one tile finishes with a linked asset.
  thumbUrl: string | null;
  estimatedBuzz: number;
  audience: string | null;
  aesthetics: string | null;
  createdAt: number;
};

export type CreateAdCampaignTileInput = {
  sizeId: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  workflowId: string;
  prompt: string;
  adCopy: AdCopy | null;
};

export type CreateAdCampaignInput = {
  userId: string;
  title: string;
  brief: BriefForPresets;
  sizeIds: string[];
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  adCopy: AdCopy | null;
  audience: string | null;
  aesthetics: string | null;
  estimatedBuzz: number;
  tiles: CreateAdCampaignTileInput[];
};

function toTile(row: AdCampaignTileRow, assetUrl?: string | null): AdCampaignTile {
  return {
    id: row.id,
    sizeId: row.sizeId,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspectRatio as AspectRatio,
    workflowId: row.workflowId,
    status: row.status,
    prompt: row.prompt,
    quantity: row.quantity,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    assetUrl: assetUrl ?? null,
  };
}

function toCampaign(
  row: AdCampaignRow,
  tiles: AdCampaignTileRow[],
  assetUrlByTileId: Map<string, string> = new Map(),
): AdCampaign {
  const mappedTiles = tiles.map((t) => toTile(t, assetUrlByTileId.get(t.id)));
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    brief: row.brief as BriefForPresets,
    sizeIds: row.sizeIds,
    referenceAssetIds: row.referenceAssetIds,
    enhancedPrompts: (row.enhancedPrompts as Record<string, unknown> | null) ?? null,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    tiles: mappedTiles,
    thumbUrl: mappedTiles.find((t) => t.assetUrl)?.assetUrl ?? null,
    estimatedBuzz: row.estimatedBuzz,
    audience: row.audience,
    aesthetics: row.aesthetics,
    createdAt: row.createdAt.getTime(),
  };
}

export async function createAdCampaign(input: CreateAdCampaignInput): Promise<AdCampaign> {
  return db.transaction(async (tx) => {
    const [campaignRow] = await tx
      .insert(adCampaignsTable)
      .values({
        userId: input.userId,
        title: input.title,
        brief: input.brief,
        sizeIds: input.sizeIds,
        referenceAssetIds: input.referenceAssetIds,
        enhancedPrompts: input.enhancedPrompts,
        adCopy: input.adCopy,
        audience: input.audience,
        aesthetics: input.aesthetics,
        estimatedBuzz: input.estimatedBuzz,
      })
      .returning();
    if (!campaignRow) throw new Error('ad campaign insert returned no row');

    const tileRows = input.tiles.length
      ? await tx
          .insert(adCampaignTilesTable)
          .values(
            input.tiles.map((t) => ({
              adCampaignId: campaignRow.id,
              sizeId: t.sizeId,
              width: t.width,
              height: t.height,
              aspectRatio: t.aspectRatio,
              workflowId: t.workflowId,
              prompt: t.prompt,
              status: 'cooking' as AdTileStatus,
              adCopy: t.adCopy,
            })),
          )
          .returning()
      : [];

    return toCampaign(campaignRow, tileRows);
  });
}

async function loadAdCampaign(userId: string, id: string): Promise<AdCampaign | null> {
  const [row] = await db
    .select()
    .from(adCampaignsTable)
    .where(and(eq(adCampaignsTable.id, id), eq(adCampaignsTable.userId, userId)))
    .limit(1);
  if (!row) return null;
  const tileRows = await db
    .select()
    .from(adCampaignTilesTable)
    .where(eq(adCampaignTilesTable.adCampaignId, row.id))
    .orderBy(adCampaignTilesTable.createdAt);

  // Build a tileId → publicUrl map for tiles that already have a linked asset.
  const assetUrlByTileId = new Map<string, string>();
  const assetIdsWithTile = tileRows
    .filter((t) => t.assetId !== null)
    .map((t) => t.assetId as string);
  if (assetIdsWithTile.length > 0) {
    const assetRows = await db
      .select({ id: assetsTable.id, publicUrl: assetsTable.publicUrl })
      .from(assetsTable)
      .where(and(inArray(assetsTable.id, assetIdsWithTile), isNull(assetsTable.deletedAt)));
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

export function getAdCampaign(userId: string, id: string): Promise<AdCampaign | null> {
  return loadAdCampaign(userId, id);
}

export async function listAdCampaigns(userId: string): Promise<AdCampaign[]> {
  const rows = await db
    .select()
    .from(adCampaignsTable)
    .where(eq(adCampaignsTable.userId, userId))
    .orderBy(desc(adCampaignsTable.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tiles = await db
    .select()
    .from(adCampaignTilesTable)
    .where(inArray(adCampaignTilesTable.adCampaignId, ids))
    .orderBy(adCampaignTilesTable.createdAt);

  const byCampaign = new Map<string, AdCampaignTileRow[]>();
  for (const t of tiles) {
    const bucket = byCampaign.get(t.adCampaignId) ?? [];
    bucket.push(t);
    byCampaign.set(t.adCampaignId, bucket);
  }

  // Resolve thumbnails: one query for the public URLs of every tile that has a
  // linked, non-deleted asset. `toCampaign` derives each campaign's `thumbUrl`
  // from the first tile (in createdAt order) that has an assetUrl.
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
 * Hard-delete an ad campaign the user owns. Cascades to `adCampaignTiles` via FK
 * `onDelete: 'cascade'`. Generations and buzz events are user-scoped audit rows
 * and intentionally survive; linked assets stay in the user's library (the
 * tile→asset FK is `set null`, but the tile is removed). No-op if the campaign
 * doesn't exist or belongs to another user.
 */
export async function deleteAdCampaign(userId: string, id: string): Promise<void> {
  await db
    .delete(adCampaignsTable)
    .where(and(eq(adCampaignsTable.id, id), eq(adCampaignsTable.userId, userId)));
}

/**
 * Update an ad campaign's editable header fields. Ownership-scoped: only the
 * keys present in `patch` are touched.
 */
export async function updateAdCampaign(
  userId: string,
  id: string,
  patch: { title?: string },
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) update.title = patch.title;

  await db
    .update(adCampaignsTable)
    .set(update)
    .where(and(eq(adCampaignsTable.id, id), eq(adCampaignsTable.userId, userId)));
}

export async function swapAdTileWorkflow(
  userId: string,
  campaignId: string,
  tileId: string,
  newWorkflowId: string,
  patch?: { prompt?: string; adCopy?: AdCopy | null },
): Promise<AdCampaignTile> {
  // Make sure the campaign belongs to the user before mutating any tile.
  const owner = await db
    .select({ id: adCampaignsTable.id })
    .from(adCampaignsTable)
    .where(and(eq(adCampaignsTable.id, campaignId), eq(adCampaignsTable.userId, userId)))
    .limit(1);
  if (owner.length === 0) throw new Error('ad campaign not found or not owned by user');

  const update: Record<string, unknown> = {
    workflowId: newWorkflowId,
    status: 'cooking',
    assetId: null,
    error: null,
    updatedAt: new Date(),
  };
  if (patch?.prompt !== undefined) update.prompt = patch.prompt;
  if (patch?.adCopy !== undefined) update.adCopy = patch.adCopy;

  const [row] = await db
    .update(adCampaignTilesTable)
    .set(update)
    .where(
      and(eq(adCampaignTilesTable.id, tileId), eq(adCampaignTilesTable.adCampaignId, campaignId)),
    )
    .returning();
  if (!row) throw new Error('ad campaign tile not found');

  return toTile(row);
}

/** Done tiles with a resolved public URL — used by the export route. */
export async function listAdCampaignAssets(
  userId: string,
  campaignId: string,
): Promise<
  Array<{
    tileId: string;
    sizeId: string;
    width: number;
    height: number;
    publicUrl: string;
    contentType: string | null;
  }>
> {
  const rows = await db
    .select({
      tileId: adCampaignTilesTable.id,
      sizeId: adCampaignTilesTable.sizeId,
      width: adCampaignTilesTable.width,
      height: adCampaignTilesTable.height,
      publicUrl: assetsTable.publicUrl,
      contentType: assetsTable.contentType,
    })
    .from(adCampaignTilesTable)
    .innerJoin(adCampaignsTable, eq(adCampaignsTable.id, adCampaignTilesTable.adCampaignId))
    .innerJoin(assetsTable, eq(assetsTable.id, adCampaignTilesTable.assetId))
    .where(
      and(
        eq(adCampaignsTable.id, campaignId),
        eq(adCampaignsTable.userId, userId),
        eq(adCampaignTilesTable.status, 'done'),
        isNull(assetsTable.deletedAt),
      ),
    );
  return rows.filter(
    (
      r,
    ): r is {
      tileId: string;
      sizeId: string;
      width: number;
      height: number;
      publicUrl: string;
      contentType: string | null;
    } => Boolean(r.publicUrl),
  );
}
