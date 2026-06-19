import 'server-only';
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets as assetsTable,
  campaigns as campaignsTable,
  type Product as ProductRow,
  productAssets as productAssetsTable,
  products as productsTable,
} from '@/lib/db/schema';

export type ProductStatus = 'live' | 'draft' | 'archived';

export type Product = {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  tags: string[];
  status: ProductStatus;
  heroAssetId?: string;
  heroUrl?: string;
  usedInCount: number;
  createdAt: number;
};

// `usedInCount` is DERIVED from the number of campaigns linked to the product
// (campaigns.product_id), not read from the stale denormalized column. Read
// paths (getProduct/listProducts) pass the live count; mutation paths that don't
// touch campaign links fall back to the column.
function toProduct(row: ProductRow, heroUrl?: string | null, usedInCount?: number): Product {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    status: row.status,
    heroAssetId: row.heroAssetId ?? undefined,
    heroUrl: heroUrl ?? undefined,
    usedInCount: usedInCount ?? row.usedInCount,
    createdAt: row.createdAt.getTime(),
  };
}

function cleanTags(tags?: string[]): string[] {
  return (tags ?? []).map((t) => t.trim()).filter(Boolean);
}

export type CreateProductInput = {
  userId: string;
  name: string;
  notes?: string;
  tags?: string[];
  status?: ProductStatus;
  imageAssetIds?: string[];
};

/**
 * Create a product and, if `imageAssetIds` are supplied, attach each to the
 * `product_assets` join in input order. The first attached asset becomes the
 * product's hero. SECURITY: assets are filtered by `userId` before attach —
 * we never link a foreign user's asset to a user's product.
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  return db.transaction(async (tx) => {
    let validImageIds: string[] = [];
    if (input.imageAssetIds && input.imageAssetIds.length > 0) {
      const owned = await tx
        .select({ id: assetsTable.id })
        .from(assetsTable)
        .where(
          and(inArray(assetsTable.id, input.imageAssetIds), eq(assetsTable.userId, input.userId)),
        );
      const ownedSet = new Set(owned.map((r) => r.id));
      validImageIds = input.imageAssetIds.filter((id) => ownedSet.has(id));
    }

    const [row] = await tx
      .insert(productsTable)
      .values({
        userId: input.userId,
        name: input.name,
        notes: input.notes?.trim() || null,
        tags: cleanTags(input.tags),
        status: input.status ?? 'live',
        heroAssetId: validImageIds[0] ?? null,
      })
      .returning();
    if (!row) throw new Error('product insert returned no row');

    if (validImageIds.length > 0) {
      await tx
        .insert(productAssetsTable)
        .values(
          validImageIds.map((id, i) => ({
            productId: row.id,
            assetId: id,
            role: i === 0 ? 'hero' : 'reference',
            position: i,
          })),
        )
        .onConflictDoNothing({
          target: [productAssetsTable.productId, productAssetsTable.assetId],
        });
      await tx
        .update(assetsTable)
        .set({ productId: row.id, ownerType: 'product' })
        .where(inArray(assetsTable.id, validImageIds));
    }

    return toProduct(row);
  });
}

type AppendProductImagesInput = {
  userId: string;
  productId: string;
  assetIds: string[];
};

export type AppendProductImagesResult = {
  product: Product;
  addedCount: number;
  skippedCount: number;
} | null;

/**
 * Append owned assets to an existing product's `product_assets` join. SECURITY:
 * caller ownership of the product and each asset is verified; foreign rows are
 * silently dropped and counted as skipped. Duplicates already on the product
 * are also counted as skipped (we pre-filter to keep `skippedCount` accurate
 * rather than relying on `.onConflictDoNothing`). New rows are appended after
 * the current max position; the product's hero is not modified by this call.
 */
export async function appendProductImages(
  input: AppendProductImagesInput,
): Promise<AppendProductImagesResult> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, input.productId), eq(productsTable.userId, input.userId)));
    if (!product) return null;

    const totalRequested = input.assetIds.length;

    const owned = await tx
      .select({ id: assetsTable.id })
      .from(assetsTable)
      .where(and(inArray(assetsTable.id, input.assetIds), eq(assetsTable.userId, input.userId)));
    const ownedSet = new Set(owned.map((r) => r.id));
    const validIds = input.assetIds.filter((id) => ownedSet.has(id));

    if (validIds.length === 0) {
      return { product: toProduct(product), addedCount: 0, skippedCount: totalRequested };
    }

    const existing = await tx
      .select({ assetId: productAssetsTable.assetId, position: productAssetsTable.position })
      .from(productAssetsTable)
      .where(eq(productAssetsTable.productId, input.productId));
    const existingSet = new Set(existing.map((r) => r.assetId));
    const newIds = validIds.filter((id) => !existingSet.has(id));
    const skippedCount = totalRequested - newIds.length;

    if (newIds.length === 0) {
      return { product: toProduct(product), addedCount: 0, skippedCount };
    }

    const startPos = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;
    await tx.insert(productAssetsTable).values(
      newIds.map((id, i) => ({
        productId: input.productId,
        assetId: id,
        role: 'reference' as const,
        position: startPos + i,
      })),
    );
    await tx
      .update(assetsTable)
      .set({ productId: input.productId, ownerType: 'product' })
      .where(inArray(assetsTable.id, newIds));

    return { product: toProduct(product), addedCount: newIds.length, skippedCount };
  });
}

export async function getProduct(userId: string, id: string): Promise<Product | null> {
  const [row] = await db
    .select({
      product: productsTable,
      heroUrl: assetsTable.publicUrl,
    })
    .from(productsTable)
    .leftJoin(assetsTable, eq(assetsTable.id, productsTable.heroAssetId))
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [usage] = await db
    .select({ n: count() })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.userId, userId), eq(campaignsTable.productId, id)));
  return toProduct(row.product, row.heroUrl, usage?.n ?? 0);
}

export async function listProducts(userId: string): Promise<Product[]> {
  const rows = await db
    .select({
      product: productsTable,
      heroUrl: assetsTable.publicUrl,
    })
    .from(productsTable)
    .leftJoin(assetsTable, eq(assetsTable.id, productsTable.heroAssetId))
    .where(eq(productsTable.userId, userId))
    .orderBy(desc(productsTable.createdAt));

  // One grouped query for every product's live campaign-usage count, then map
  // by product id. Avoids an N+1 of per-product counts.
  const usageRows = await db
    .select({ productId: campaignsTable.productId, n: count() })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.userId, userId), isNotNull(campaignsTable.productId)))
    .groupBy(campaignsTable.productId);
  const usageByProduct = new Map(usageRows.map((u) => [u.productId, u.n]));

  return rows.map((r) => toProduct(r.product, r.heroUrl, usageByProduct.get(r.product.id) ?? 0));
}

export async function deleteProduct(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .returning({ id: productsTable.id });
  return result.length > 0;
}

export type UpdateProductPatch = Partial<Omit<Product, 'id' | 'userId' | 'createdAt'>> & {
  imageAssetIds?: string[];
};

/**
 * Update product scalar fields and, if `imageAssetIds` is supplied, rewrite the
 * `product_assets` join to match (order = position; first = hero). SECURITY:
 * candidate asset ids are filtered by ownership before any link is written;
 * unknown / foreign ids are silently dropped.
 */
export async function updateProduct(
  userId: string,
  id: string,
  patch: UpdateProductPatch,
): Promise<Product | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
      .limit(1);
    if (!existing) return null;

    const set: Partial<typeof productsTable.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
    if (patch.tags !== undefined) set.tags = cleanTags(patch.tags);
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.usedInCount !== undefined) set.usedInCount = patch.usedInCount;

    let validImageIds: string[] | null = null;
    if (patch.imageAssetIds !== undefined) {
      if (patch.imageAssetIds.length === 0) {
        validImageIds = [];
      } else {
        const owned = await tx
          .select({ id: assetsTable.id })
          .from(assetsTable)
          .where(and(inArray(assetsTable.id, patch.imageAssetIds), eq(assetsTable.userId, userId)));
        const ownedSet = new Set(owned.map((r) => r.id));
        validImageIds = patch.imageAssetIds.filter((aid) => ownedSet.has(aid));
      }
      set.heroAssetId = validImageIds[0] ?? null;
    }

    const [row] = await tx
      .update(productsTable)
      .set(set)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
      .returning();
    if (!row) return null;

    if (validImageIds !== null) {
      await tx.delete(productAssetsTable).where(eq(productAssetsTable.productId, id));
      if (validImageIds.length > 0) {
        await tx.insert(productAssetsTable).values(
          validImageIds.map((aid, i) => ({
            productId: id,
            assetId: aid,
            role: i === 0 ? 'hero' : 'reference',
            position: i,
          })),
        );
        await tx
          .update(assetsTable)
          .set({ productId: id, ownerType: 'product' })
          .where(inArray(assetsTable.id, validImageIds));
      }
    }

    return toProduct(row);
  });
}
