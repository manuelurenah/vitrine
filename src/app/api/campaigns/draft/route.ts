import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCampaignDraft } from '@/lib/adCopy';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { isPresetId, type PresetId } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const draftSchema = z.object({
  prompt: z.string().min(1).max(2000),
  presetIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPresetId) as PresetId[])
    .refine((ids) => ids.length >= 1, 'at least one preset required'),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  productName: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = draftSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { prompt, presetIds, referenceAssetIds, productName } = parsed.data;

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  // Resolve reference asset URLs (only to count them — the LLM call doesn't
  // need the URLs themselves, just the count for context).
  let referenceCount = 0;
  try {
    if (referenceAssetIds.length > 0) {
      const urls = await getPublicUrls(userKey, referenceAssetIds);
      referenceCount = urls.length;
    }
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const { draft, meta } = await generateCampaignDraft({
    prompt,
    brand,
    presetIds,
    referenceCount,
    productName,
  });

  return NextResponse.json({ draft, meta });
}
