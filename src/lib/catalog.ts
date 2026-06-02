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
  usedInCount: number;
  createdAt: number;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    status: row.status,
    heroAssetId: row.heroAssetId ?? undefined,
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
        status: input.status ?? 'draft',
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
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .limit(1);
  return row ? toProduct(row) : null;
}

export async function listProducts(userId: string): Promise<Product[]> {
  const rows = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.userId, userId))
    .orderBy(desc(productsTable.createdAt));
  return rows.map(toProduct);
}

export async function deleteProduct(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .returning({ id: productsTable.id });
  return result.length > 0;
}

export async function updateProduct(
  userId: string,
  id: string,
  patch: Partial<Omit<Product, 'id' | 'userId' | 'createdAt'>>,
): Promise<Product | null> {
  const set: Partial<typeof productsTable.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
  if (patch.tags !== undefined) set.tags = cleanTags(patch.tags);
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.usedInCount !== undefined) set.usedInCount = patch.usedInCount;

  const [row] = await db
    .update(productsTable)
    .set(set)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .returning();
  return row ? toProduct(row) : null;
}
