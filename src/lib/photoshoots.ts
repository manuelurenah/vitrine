import 'server-only';
import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets as assetsTable,
  generations as generationsTable,
  type Photoshoot as PhotoshootRow,
  type PhotoshootTile as PhotoshootTileRow,
  photoshoots as photoshootsTable,
  photoshootTiles as photoshootTilesTable,
} from '@/lib/db/schema';
import type { TileStatus } from './campaigns';
import type { PhotoshootBrief, PhotoshootRatio, PhotoshootTemplateId } from './photoshootTemplates';

export type PhotoshootTile = {
  id: string;
  templateId: PhotoshootTemplateId;
  variantIndex: number;
  workflowId: string;
  status: TileStatus;
  prompt: string;
  quantity: number;
  /**
   * UUID of the asset row this tile resolved to once the workflow finished.
   * Null while the workflow is queued/cooking or if asset-linking hasn't run.
   * Set by `syncAssetsFromSnapshot` on terminal workflow status.
   */
  assetId: string | null;
};

export type Photoshoot = {
  id: string;
  userId: string;
  /** UUID of the source product this shoot was generated for. Null when no product was linked. */
  productId: string | null;
  title: string;
  brief: PhotoshootBrief;
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  tiles: PhotoshootTile[];
  estimatedBuzz: number;
  createdAt: number;
  /**
   * Resolved thumbnail URLs from completed tiles (in tile order). Populated by
   * `listPhotoshoots` for the grid view; empty for `getPhotoshoot` since the
   * detail page renders live tile cards instead.
   */
  thumbUrls: string[];
};

function toTile(row: PhotoshootTileRow): PhotoshootTile {
  return {
    id: row.id,
    templateId: row.templateId as PhotoshootTemplateId,
    variantIndex: row.variantIndex,
    workflowId: row.workflowId,
    status: row.status,
    prompt: row.prompt,
    quantity: row.quantity,
    assetId: row.assetId,
  };
}

function toPhotoshoot(
  row: PhotoshootRow,
  tiles: PhotoshootTileRow[],
  thumbUrls: string[] = [],
): Photoshoot {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId ?? null,
    title: row.title,
    brief: row.brief as PhotoshootBrief,
    referenceAssetIds: row.referenceAssetIds,
    enhancedPrompts: (row.enhancedPrompts as Record<string, unknown> | null) ?? null,
    tiles: tiles.map(toTile),
    estimatedBuzz: row.estimatedBuzz,
    thumbUrls,
    createdAt: row.createdAt.getTime(),
  };
}

export type CreatePhotoshootInput = {
  userId: string;
  title: string;
  brief: PhotoshootBrief;
  tiles: Array<{
    templateId: PhotoshootTemplateId;
    variantIndex: number;
    workflowId: string;
    prompt: string;
    quantity?: number;
  }>;
  estimatedBuzz: number;
  referenceAssetIds?: string[];
  enhancedPrompts?: Record<string, unknown> | null;
};

export async function createPhotoshoot(input: CreatePhotoshootInput): Promise<Photoshoot> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(photoshootsTable)
      .values({
        userId: input.userId,
        title: input.title,
        brief: input.brief,
        ratio: input.brief.ratio satisfies PhotoshootRatio,
        variantsPerTemplate: input.brief.variantsPerTemplate,
        templateIds: input.brief.templateIds,
        referenceAssetIds: input.referenceAssetIds ?? [],
        enhancedPrompts: input.enhancedPrompts ?? null,
        estimatedBuzz: input.estimatedBuzz,
      })
      .returning();
    if (!row) throw new Error('photoshoot insert returned no row');

    const tiles = input.tiles.length
      ? await tx
          .insert(photoshootTilesTable)
          .values(
            input.tiles.map((t) => ({
              photoshootId: row.id,
              templateId: t.templateId,
              variantIndex: t.variantIndex,
              workflowId: t.workflowId,
              prompt: t.prompt,
              quantity: t.quantity ?? 1,
              status: 'cooking' as TileStatus,
            })),
          )
          .returning()
      : [];

    return toPhotoshoot(row, tiles);
  });
}

export async function getPhotoshoot(userId: string, id: string): Promise<Photoshoot | null> {
  const [row] = await db
    .select()
    .from(photoshootsTable)
    .where(and(eq(photoshootsTable.id, id), eq(photoshootsTable.userId, userId)))
    .limit(1);
  if (!row) return null;
  const tiles = await db
    .select()
    .from(photoshootTilesTable)
    .where(eq(photoshootTilesTable.photoshootId, row.id))
    .orderBy(photoshootTilesTable.createdAt);
  return toPhotoshoot(row, tiles);
}

export async function swapPhotoshootTileWorkflow(
  userId: string,
  photoshootId: string,
  tileId: string,
  newWorkflowId: string,
): Promise<PhotoshootTile | null> {
  const owner = await db
    .select({ id: photoshootsTable.id })
    .from(photoshootsTable)
    .where(and(eq(photoshootsTable.id, photoshootId), eq(photoshootsTable.userId, userId)))
    .limit(1);
  if (owner.length === 0) return null;

  const [row] = await db
    .update(photoshootTilesTable)
    .set({
      workflowId: newWorkflowId,
      status: 'cooking' as TileStatus,
      updatedAt: new Date(),
    })
    .where(
      and(eq(photoshootTilesTable.id, tileId), eq(photoshootTilesTable.photoshootId, photoshootId)),
    )
    .returning();
  return row ? toTile(row) : null;
}

export async function listPhotoshoots(userId: string): Promise<Photoshoot[]> {
  const rows = await db
    .select()
    .from(photoshootsTable)
    .where(eq(photoshootsTable.userId, userId))
    .orderBy(desc(photoshootsTable.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  // Pull tiles + their resolved thumbnail URL in one query. We try two
  // sources: the linked `assets.publicUrl` (set by `syncAssetsFromSnapshot`
  // when wired) and a fallback extracted from the cached `generations.snapshot`.
  // The second covers tiles that finished before the asset-linking step ran.
  const tileRows = await db
    .select({
      tile: photoshootTilesTable,
      assetPublicUrl: assetsTable.publicUrl,
      snapshot: generationsTable.snapshot,
    })
    .from(photoshootTilesTable)
    .leftJoin(assetsTable, eq(assetsTable.id, photoshootTilesTable.assetId))
    .leftJoin(generationsTable, eq(generationsTable.workflowId, photoshootTilesTable.workflowId))
    .where(inArray(photoshootTilesTable.photoshootId, ids))
    .orderBy(photoshootTilesTable.createdAt);

  const tilesByShoot = new Map<string, PhotoshootTileRow[]>();
  const thumbsByShoot = new Map<string, string[]>();
  for (const { tile, assetPublicUrl, snapshot } of tileRows) {
    const tileBucket = tilesByShoot.get(tile.photoshootId) ?? [];
    tileBucket.push(tile);
    tilesByShoot.set(tile.photoshootId, tileBucket);
    const thumb = assetPublicUrl ?? firstSnapshotImage(snapshot);
    if (thumb) {
      const thumbBucket = thumbsByShoot.get(tile.photoshootId) ?? [];
      if (thumbBucket.length < 4) thumbBucket.push(thumb);
      thumbsByShoot.set(tile.photoshootId, thumbBucket);
    }
  }
  return rows.map((r) =>
    toPhotoshoot(r, tilesByShoot.get(r.id) ?? [], thumbsByShoot.get(r.id) ?? []),
  );
}

function firstSnapshotImage(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  try {
    const urls = extractImageUrls(snapshot as WorkflowSnapshot);
    return urls[0] ?? null;
  } catch {
    return null;
  }
}
