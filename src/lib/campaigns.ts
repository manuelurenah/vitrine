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
  adCopy: AdCopy | null;
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
  estimatedBuzz: number;
  audience: string | null;
  aesthetics: string | null;
  createdAt: number;
};

function toTile(row: CampaignTileRow): CampaignTile {
  return {
    id: row.id,
    presetId: row.presetId as PresetId,
    workflowId: row.workflowId,
    status: row.status,
    prompt: row.prompt,
    quantity: row.quantity,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
  };
}

function toCampaign(row: CampaignRow, tiles: CampaignTileRow[]): Campaign {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    brief: row.brief as BriefForPresets,
    presetIds: row.presetIds as PresetId[],
    referenceAssetIds: row.referenceAssetIds,
    variantsPerPreset: row.variantsPerPreset,
    enhancedPrompts: (row.enhancedPrompts as Record<string, unknown> | null) ?? null,
    tiles: tiles.map(toTile),
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
  const tiles = await db
    .select()
    .from(campaignTilesTable)
    .where(eq(campaignTilesTable.campaignId, row.id))
    .orderBy(campaignTilesTable.createdAt);
  return toCampaign(row, tiles);
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

  return rows.map((r) => toCampaign(r, byCampaign.get(r.id) ?? []));
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
