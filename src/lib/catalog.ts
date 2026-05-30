import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products as productsTable, type Product as ProductRow } from '@/lib/db/schema';

export type ProductStatus = 'live' | 'draft' | 'archived';

export type Product = {
  id: string;
  userId: string;
  name: string;
  sku?: string;
  notes?: string;
  tags: string[];
  status: ProductStatus;
  usedInCount: number;
  createdAt: number;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    sku: row.sku ?? undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    status: row.status,
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
  sku?: string;
  notes?: string;
  tags?: string[];
  status?: ProductStatus;
};

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const [row] = await db
    .insert(productsTable)
    .values({
      userId: input.userId,
      name: input.name,
      sku: input.sku?.trim() || null,
      notes: input.notes?.trim() || null,
      tags: cleanTags(input.tags),
      status: input.status ?? 'draft',
    })
    .returning();
  return toProduct(row!);
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
  if (patch.sku !== undefined) set.sku = patch.sku?.trim() || null;
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
