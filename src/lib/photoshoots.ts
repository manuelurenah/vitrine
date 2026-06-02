import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  photoshoots as photoshootsTable,
  photoshootTiles as photoshootTilesTable,
  type Photoshoot as PhotoshootRow,
  type PhotoshootTile as PhotoshootTileRow,
} from '@/lib/db/schema';
import type {
  PhotoshootBrief,
  PhotoshootRatio,
  PhotoshootTemplateId,
} from './photoshootTemplates';
import type { TileStatus } from './campaigns';

export type PhotoshootTile = {
  id: string;
  templateId: PhotoshootTemplateId;
  variantIndex: number;
  workflowId: string;
  status: TileStatus;
  prompt: string;
  quantity: number;
};

export type Photoshoot = {
  id: string;
  userId: string;
  title: string;
  brief: PhotoshootBrief;
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  tiles: PhotoshootTile[];
  estimatedBuzz: number;
  createdAt: number;
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
  };
}

function toPhotoshoot(row: PhotoshootRow, tiles: PhotoshootTileRow[]): Photoshoot {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    brief: row.brief as PhotoshootBrief,
    referenceAssetIds: row.referenceAssetIds,
    enhancedPrompts: (row.enhancedPrompts as Record<string, unknown> | null) ?? null,
    tiles: tiles.map(toTile),
    estimatedBuzz: row.estimatedBuzz,
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

export async function listPhotoshoots(userId: string): Promise<Photoshoot[]> {
  const rows = await db
    .select()
    .from(photoshootsTable)
    .where(eq(photoshootsTable.userId, userId))
    .orderBy(desc(photoshootsTable.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tiles = await db
    .select()
    .from(photoshootTilesTable)
    .where(inArray(photoshootTilesTable.photoshootId, ids))
    .orderBy(photoshootTilesTable.createdAt);

  const byShoot = new Map<string, PhotoshootTileRow[]>();
  for (const t of tiles) {
    const bucket = byShoot.get(t.photoshootId) ?? [];
    bucket.push(t);
    byShoot.set(t.photoshootId, bucket);
  }
  return rows.map((r) => toPhotoshoot(r, byShoot.get(r.id) ?? []));
}
