import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  brandProfiles,
  type BrandProfile as BrandRow,
} from '@/lib/db/schema';
import { getOnboarding, type OnboardingPayload } from '@/lib/onboarding';

export type BrandProfile = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceUrl: string | null;
  palette: string[];
  tone: string | null;
  industry: string | null;
  tagline: string | null;
  font: string | null;
  logoUrl: string | null;
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
    tagline: row.tagline,
    font: row.font,
    logoUrl: row.logoUrl,
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
  tagline?: string | null;
  font?: string | null;
  logoUrl?: string | null;
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
      tagline: input.tagline ?? null,
      font: input.font ?? null,
      logoUrl: input.logoUrl ?? null,
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

type BrandSeed = {
  name: string | null;
  description: string | null;
  sourceUrl: string | null;
  palette: string[];
  tone: string | null;
  tagline: string | null;
  font: string | null;
  logoUrl: string | null;
};

function seedFromPayload(payload: OnboardingPayload): BrandSeed {
  const scrape = payload.scrape ?? null;
  const trimOrNull = (v: string | null | undefined): string | null => {
    const t = (v ?? '').trim();
    return t.length > 0 ? t : null;
  };
  const colors =
    payload.colors && payload.colors.length > 0 ? payload.colors : scrape?.palette ?? [];
  const tone =
    payload.tone && payload.tone.length > 0 ? payload.tone.join(', ') : null;
  return {
    name: trimOrNull(payload.brandName) ?? trimOrNull(scrape?.brandName),
    description: trimOrNull(payload.description) ?? trimOrNull(scrape?.description),
    sourceUrl: trimOrNull(payload.websiteUrl) ?? trimOrNull(scrape?.finalUrl),
    palette: colors,
    tone,
    tagline: trimOrNull(payload.tagline),
    font: trimOrNull(payload.font) ?? trimOrNull(scrape?.font),
    logoUrl: trimOrNull(payload.logoUrl) ?? trimOrNull(scrape?.logoUrl),
  };
}

export async function ensureDefaultBrand(userId: string, name = 'my brand'): Promise<BrandProfile> {
  const seed = seedFromPayload((await getOnboarding(userId)).payload);
  const existing = await getDefaultBrand(userId);
  if (existing) {
    const patch: Partial<BrandProfile> = {};
    if ((existing.name === 'my brand' || existing.name.trim().length === 0) && seed.name)
      patch.name = seed.name;
    if (!existing.description && seed.description) patch.description = seed.description;
    if (!existing.sourceUrl && seed.sourceUrl) patch.sourceUrl = seed.sourceUrl;
    if (existing.palette.length === 0 && seed.palette.length > 0) patch.palette = seed.palette;
    if (!existing.tone && seed.tone) patch.tone = seed.tone;
    if (!existing.tagline && seed.tagline) patch.tagline = seed.tagline;
    if (!existing.font && seed.font) patch.font = seed.font;
    if (!existing.logoUrl && seed.logoUrl) patch.logoUrl = seed.logoUrl;
    if (Object.keys(patch).length === 0) return existing;
    const updated = await updateBrand(userId, existing.id, patch);
    return updated ?? existing;
  }
  return createBrand({
    userId,
    name: seed.name ?? name,
    description: seed.description,
    sourceUrl: seed.sourceUrl,
    palette: seed.palette,
    tone: seed.tone,
    tagline: seed.tagline,
    font: seed.font,
    logoUrl: seed.logoUrl,
    isDefault: true,
  });
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
  if (patch.tagline !== undefined) set.tagline = patch.tagline;
  if (patch.font !== undefined) set.font = patch.font;
  if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl;
  if (patch.isDefault !== undefined) set.isDefault = patch.isDefault;

  const [row] = await db
    .update(brandProfiles)
    .set(set)
    .where(and(eq(brandProfiles.id, id), eq(brandProfiles.userId, userId)))
    .returning();
  return row ? toBrand(row) : null;
}
