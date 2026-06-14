import 'server-only';
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { extractImageUrls, type WorkflowSnapshot } from '@/lib/civitai';
import { db } from '@/lib/db';
import {
  type Asset as AssetRow,
  assets,
  campaignTiles,
  type NewAsset,
  photoshootTiles,
  productAssets,
  products,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { getObjectAsDataUrl, isLocalObjectStorage, presignGet } from '@/lib/s3';

export type AssetKind = NewAsset['kind'];

export type AssetMetadata = {
  collection?: string;
  tags?: string[];
  description?: string;
  [key: string]: unknown;
};

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
  metadata: AssetMetadata;
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
    metadata: (row.metadata ?? {}) as AssetMetadata,
    createdAt: row.createdAt.getTime(),
  };
}

export type AssetOwnerType = NonNullable<NewAsset['ownerType']>;

export type CreateAssetInput = {
  userId: string;
  kind: AssetKind;
  ownerType?: AssetOwnerType | null;
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
      ownerType: input.ownerType ?? null,
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

/**
 * Predicate for the assets *library* view: uploads + ad-hoc generated assets,
 * but NOT generated images that belong to a campaign or photoshoot tile (those
 * have their own pages). Campaign/photoshoot outputs are the only generated
 * rows with a `sourceTileId`, so the exclusion is exactly
 * `generated && sourceTileId != null`.
 */
export function isLibraryAsset(a: { kind: AssetKind; sourceTileId: string | null }): boolean {
  return !(a.kind === 'generated' && a.sourceTileId != null);
}

/**
 * Like `listAssets` but scoped to the library view (see `isLibraryAsset`).
 * `or(ne(kind,'generated'), isNull(sourceTileId))` is the SQL De Morgan form of
 * "NOT (generated AND tile-linked)".
 */
export async function listLibraryAssets(userId: string, limit = 200): Promise<Asset[]> {
  const rows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.userId, userId),
        isNull(assets.deletedAt),
        // exclude campaign/photoshoot generated images (they have their own pages)
        or(ne(assets.kind, 'generated'), isNull(assets.sourceTileId)),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(limit);
  return rows.map(toAsset);
}

export type AssetMetadataPatch = {
  collection?: string | null;
  tags?: string[] | null;
  description?: string | null;
};

export async function updateAsset(
  userId: string,
  id: string,
  patch: AssetMetadataPatch,
): Promise<Asset | null> {
  const [current] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.userId, userId), isNull(assets.deletedAt)))
    .limit(1);
  if (!current) return null;

  const meta = { ...((current.metadata as Record<string, unknown>) ?? {}) };
  if (patch.collection !== undefined) {
    if (patch.collection && patch.collection.trim()) meta.collection = patch.collection.trim();
    else delete meta.collection;
  }
  if (patch.tags !== undefined) {
    if (patch.tags && patch.tags.length > 0) {
      meta.tags = patch.tags.map((t) => t.trim()).filter(Boolean);
    } else {
      delete meta.tags;
    }
  }
  if (patch.description !== undefined) {
    if (patch.description && patch.description.trim()) meta.description = patch.description.trim();
    else delete meta.description;
  }

  const [row] = await db
    .update(assets)
    .set({ metadata: meta })
    .where(and(eq(assets.id, id), eq(assets.userId, userId), isNull(assets.deletedAt)))
    .returning();
  return row ? toAsset(row) : null;
}

export async function softDeleteAsset(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(assets)
    .set({ deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId), isNull(assets.deletedAt)))
    .returning({ id: assets.id });
  return rows.length > 0;
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

/**
 * Resolve a list of picker IDs to orchestrator-fetchable URLs, preserving input
 * order. SECURITY: every DB lookup is scoped to `userId`. Callers must pass
 * the requesting user's key — bare IDs from a request body are never trusted
 * cross-tenant. A picker ID that belongs to another user is treated as missing.
 *
 * Accepts:
 *   - `asset:<uuid>` resolves directly via the `assets` table.
 *   - `product:<uuid>` resolves to the product's hero asset (or first attached
 *     `product_assets` row, scoped to that product's user).
 *   - A bare UUID is treated as `asset:<uuid>`.
 *
 * If the asset row has a `publicUrl`, it's used directly; otherwise we mint a
 * presigned GET URL (1h TTL by default — short enough that leaked URLs expire
 * before they're useful). Throws if any id is missing or not owned by the user.
 */
export async function getPublicUrls(
  userId: string,
  pickerIds: string[],
  opts: { presignTtlSeconds?: number } = {},
): Promise<string[]> {
  if (pickerIds.length === 0) return [];

  const parsed = pickerIds.map((id) => {
    const colonIdx = id.indexOf(':');
    if (colonIdx === -1) return { kind: 'asset' as const, ref: id, original: id };
    const kind = id.slice(0, colonIdx);
    const ref = id.slice(colonIdx + 1);
    if (kind === 'asset' || kind === 'product') {
      return { kind, ref, original: id };
    }
    return { kind: 'asset' as const, ref: id, original: id };
  });

  const productIds = parsed.filter((p) => p.kind === 'product').map((p) => p.ref);
  const productHeroByProductId = new Map<string, string>();
  if (productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, heroAssetId: products.heroAssetId })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.userId, userId)));
    for (const row of productRows) {
      if (row.heroAssetId) productHeroByProductId.set(row.id, row.heroAssetId);
    }
    const stillMissing = productIds.filter((pid) => !productHeroByProductId.has(pid));
    if (stillMissing.length > 0) {
      const fallbackRows = await db
        .select({
          productId: productAssets.productId,
          assetId: productAssets.assetId,
          position: productAssets.position,
        })
        .from(productAssets)
        .innerJoin(products, eq(products.id, productAssets.productId))
        .where(and(inArray(productAssets.productId, stillMissing), eq(products.userId, userId)))
        .orderBy(productAssets.position);
      for (const row of fallbackRows) {
        if (!productHeroByProductId.has(row.productId)) {
          productHeroByProductId.set(row.productId, row.assetId);
        }
      }
    }
    const missingProducts = productIds.filter((pid) => !productHeroByProductId.has(pid));
    if (missingProducts.length > 0) {
      throw new MissingReferenceError(missingProducts.length, 'products');
    }
  }

  const resolvedAssetIds = parsed.map((p) =>
    p.kind === 'product' ? productHeroByProductId.get(p.ref)! : p.ref,
  );
  const uniqueAssetIds = Array.from(new Set(resolvedAssetIds));

  const rows = await db
    .select({
      id: assets.id,
      bucket: assets.bucket,
      storageKey: assets.storageKey,
      publicUrl: assets.publicUrl,
    })
    .from(assets)
    .where(
      and(inArray(assets.id, uniqueAssetIds), eq(assets.userId, userId), isNull(assets.deletedAt)),
    );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = uniqueAssetIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new MissingReferenceError(missing.length, 'assets');
  }

  const ttl = opts.presignTtlSeconds ?? 3600;
  const uploadsBucket = env.S3_BUCKET_UPLOADS ?? 'uploads';
  // Local MinIO dev: orchestrator can't fetch `http://localhost`, so inline
  // every reference as a data URL. Prod buckets (R2, public CDN) stay as
  // public/presigned URLs.
  const inlineForOrchestrator = isLocalObjectStorage();
  return Promise.all(
    resolvedAssetIds.map(async (id) => {
      const row = byId.get(id)!;
      const bucketKind: 'upload' | 'asset' = row.bucket === uploadsBucket ? 'upload' : 'asset';
      if (inlineForOrchestrator) {
        return getObjectAsDataUrl({ key: row.storageKey, bucketKind });
      }
      if (row.publicUrl) return row.publicUrl;
      return presignGet(row.storageKey, ttl, bucketKind);
    }),
  );
}

/**
 * Thrown by `getPublicUrls` when one or more picker IDs cannot be resolved
 * (missing, not owned by the user, or product with no asset). The error
 * message intentionally omits the raw IDs to avoid leaking ownership info
 * through error reflection — the count and kind are enough for the UI.
 */
export class MissingReferenceError extends Error {
  readonly count: number;
  readonly kind: 'assets' | 'products';
  constructor(count: number, kind: 'assets' | 'products') {
    super(`${count} reference ${kind} not found or not accessible`);
    this.name = 'MissingReferenceError';
    this.count = count;
    this.kind = kind;
  }
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
