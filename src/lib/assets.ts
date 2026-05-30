import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets,
  campaignTiles,
  photoshootTiles,
  productAssets,
  type Asset as AssetRow,
  type NewAsset,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { extractImageUrls, type WorkflowSnapshot } from '@/lib/civitai';

export type AssetKind = NewAsset['kind'];

export type Asset = {
  id: string;
  userId: string;
  kind: AssetKind;
  brandId: string | null;
  productId: string | null;
  bucket: string;
  storageKey: string;
  publicUrl: string | null;
  contentType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  workflowId: string | null;
  sourceTileId: string | null;
  createdAt: number;
};

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    brandId: row.brandId,
    productId: row.productId,
    bucket: row.bucket,
    storageKey: row.storageKey,
    publicUrl: row.publicUrl,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    dominantColor: row.dominantColor,
    workflowId: row.workflowId,
    sourceTileId: row.sourceTileId,
    createdAt: row.createdAt.getTime(),
  };
}

export type CreateAssetInput = {
  userId: string;
  kind: AssetKind;
  bucket: string;
  storageKey: string;
  publicUrl?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  sha256?: string | null;
  dominantColor?: string | null;
  brandId?: string | null;
  productId?: string | null;
  workflowId?: string | null;
  sourceTileId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const [row] = await db
    .insert(assets)
    .values({
      userId: input.userId,
      kind: input.kind,
      bucket: input.bucket,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl ?? null,
      contentType: input.contentType ?? null,
      byteSize: input.byteSize ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      sha256: input.sha256 ?? null,
      dominantColor: input.dominantColor ?? null,
      brandId: input.brandId ?? null,
      productId: input.productId ?? null,
      workflowId: input.workflowId ?? null,
      sourceTileId: input.sourceTileId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();
  return toAsset(row!);
}

export async function getAsset(userId: string, id: string): Promise<Asset | null> {
  const [row] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.userId, userId), isNull(assets.deletedAt)))
    .limit(1);
  return row ? toAsset(row) : null;
}

export async function listAssets(userId: string, limit = 200): Promise<Asset[]> {
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)))
    .orderBy(desc(assets.createdAt))
    .limit(limit);
  return rows.map(toAsset);
}

export async function listAssetsForProduct(productId: string): Promise<Asset[]> {
  const rows = await db
    .select({ asset: assets })
    .from(productAssets)
    .innerJoin(assets, eq(productAssets.assetId, assets.id))
    .where(and(eq(productAssets.productId, productId), isNull(assets.deletedAt)))
    .orderBy(productAssets.position);
  return rows.map((r) => toAsset(r.asset));
}

export async function attachAssetToProduct(
  productId: string,
  assetId: string,
  role: 'hero' | 'reference' = 'reference',
  position = 0,
): Promise<void> {
  await db
    .insert(productAssets)
    .values({ productId, assetId, role, position })
    .onConflictDoNothing({ target: [productAssets.productId, productAssets.assetId] });
}

/**
 * Inspect a workflow snapshot for produced images and, for each, create an
 * `assets` row and link it to the originating tile (campaign or photoshoot).
 *
 * Returns the number of new assets recorded.
 */
export async function syncAssetsFromSnapshot(
  userId: string,
  snapshot: WorkflowSnapshot,
): Promise<number> {
  const urls = extractImageUrls(snapshot);
  if (urls.length === 0) return 0;

  const workflowId = snapshot.id;
  const bucket = env.S3_BUCKET_ASSETS ?? 'assets';

  // Resolve the owning tile (if any) so we can attach asset and mark the tile
  // done. Workflows are referenced from either campaign_tiles or photoshoot_tiles.
  const [campaignTile] = await db
    .select()
    .from(campaignTiles)
    .where(eq(campaignTiles.workflowId, workflowId))
    .limit(1);
  const [photoshootTile] = !campaignTile
    ? await db
        .select()
        .from(photoshootTiles)
        .where(eq(photoshootTiles.workflowId, workflowId))
        .limit(1)
    : [];

  const sourceTileId = campaignTile?.id ?? photoshootTile?.id ?? null;

  let inserted = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const storageKey = `${workflowId}/${i}`;
    const [row] = await db
      .insert(assets)
      .values({
        userId,
        kind: 'generated',
        bucket,
        storageKey,
        publicUrl: url,
        workflowId,
        sourceTileId,
      })
      .onConflictDoNothing({ target: [assets.bucket, assets.storageKey] })
      .returning();
    if (row) {
      inserted += 1;
      // Link the first asset back to its tile so the UI can render it.
      if (i === 0 && sourceTileId) {
        if (campaignTile) {
          await db
            .update(campaignTiles)
            .set({ assetId: row.id, status: 'done', updatedAt: new Date() })
            .where(eq(campaignTiles.id, sourceTileId));
        } else if (photoshootTile) {
          await db
            .update(photoshootTiles)
            .set({ assetId: row.id, status: 'done', updatedAt: new Date() })
            .where(eq(photoshootTiles.id, sourceTileId));
        }
      }
    }
  }
  return inserted;
}

export async function markTileFailed(workflowId: string, errorMsg: string): Promise<void> {
  const [campaignTile] = await db
    .select({ id: campaignTiles.id })
    .from(campaignTiles)
    .where(eq(campaignTiles.workflowId, workflowId))
    .limit(1);
  if (campaignTile) {
    await db
      .update(campaignTiles)
      .set({ status: 'failed', error: errorMsg, updatedAt: new Date() })
      .where(eq(campaignTiles.id, campaignTile.id));
    return;
  }
  const [photoshootTile] = await db
    .select({ id: photoshootTiles.id })
    .from(photoshootTiles)
    .where(eq(photoshootTiles.workflowId, workflowId))
    .limit(1);
  if (photoshootTile) {
    await db
      .update(photoshootTiles)
      .set({ status: 'failed', error: errorMsg, updatedAt: new Date() })
      .where(eq(photoshootTiles.id, photoshootTile.id));
  }
}
