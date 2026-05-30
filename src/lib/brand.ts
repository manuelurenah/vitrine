import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  brandProfiles,
  type BrandProfile as BrandRow,
} from '@/lib/db/schema';

export type BrandProfile = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceUrl: string | null;
  palette: string[];
  tone: string | null;
  industry: string | null;
  audience: string | null;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

function toBrand(row: BrandRow): BrandProfile {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    sourceUrl: row.sourceUrl,
    palette: Array.isArray(row.palette) ? (row.palette as string[]) : [],
    tone: row.tone,
    industry: row.industry,
    audience: row.audience,
    isDefault: row.isDefault,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export type CreateBrandInput = {
  userId: string;
  name: string;
  description?: string | null;
  sourceUrl?: string | null;
  palette?: string[];
  tone?: string | null;
  industry?: string | null;
  audience?: string | null;
  isDefault?: boolean;
};

export async function createBrand(input: CreateBrandInput): Promise<BrandProfile> {
  const [row] = await db
    .insert(brandProfiles)
    .values({
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      sourceUrl: input.sourceUrl ?? null,
      palette: input.palette ?? [],
      tone: input.tone ?? null,
      industry: input.industry ?? null,
      audience: input.audience ?? null,
      isDefault: input.isDefault ?? false,
    })
    .returning();
  return toBrand(row!);
}

export async function getBrand(userId: string, id: string): Promise<BrandProfile | null> {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(and(eq(brandProfiles.id, id), eq(brandProfiles.userId, userId)))
    .limit(1);
  return row ? toBrand(row) : null;
}

export async function listBrands(userId: string): Promise<BrandProfile[]> {
  const rows = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.userId, userId))
    .orderBy(desc(brandProfiles.createdAt));
  return rows.map(toBrand);
}

export async function getDefaultBrand(userId: string): Promise<BrandProfile | null> {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(and(eq(brandProfiles.userId, userId), eq(brandProfiles.isDefault, true)))
    .limit(1);
  return row ? toBrand(row) : null;
}

export async function ensureDefaultBrand(userId: string, name = 'my brand'): Promise<BrandProfile> {
  const existing = await getDefaultBrand(userId);
  if (existing) return existing;
  return createBrand({ userId, name, isDefault: true });
}

export async function updateBrand(
  userId: string,
  id: string,
  patch: Partial<Omit<BrandProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<BrandProfile | null> {
  const set: Partial<typeof brandProfiles.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.sourceUrl !== undefined) set.sourceUrl = patch.sourceUrl;
  if (patch.palette !== undefined) set.palette = patch.palette;
  if (patch.tone !== undefined) set.tone = patch.tone;
  if (patch.industry !== undefined) set.industry = patch.industry;
  if (patch.audience !== undefined) set.audience = patch.audience;
  if (patch.isDefault !== undefined) set.isDefault = patch.isDefault;

  const [row] = await db
    .update(brandProfiles)
    .set(set)
    .where(and(eq(brandProfiles.id, id), eq(brandProfiles.userId, userId)))
    .returning();
  return row ? toBrand(row) : null;
}
