import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assets as assetsTable,
  productAssets as productAssetsTable,
  products as productsTable,
  type Product as ProductRow,
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

function toProduct(row: ProductRow, heroUrl?: string | null): Product {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    status: row.status,
    heroAssetId: row.heroAssetId ?? undefined,
    heroUrl: heroUrl ?? undefined,
    usedInCount: row.usedInCount,
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
          and(
            inArray(assetsTable.id, input.imageAssetIds),
            eq(assetsTable.userId, input.userId),
          ),
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
  return row ? toProduct(row.product, row.heroUrl) : null;
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
  return rows.map((r) => toProduct(r.product, r.heroUrl));
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
          .where(
            and(
              inArray(assetsTable.id, patch.imageAssetIds),
              eq(assetsTable.userId, userId),
            ),
          );
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
