import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AD_SIZES, isAdSizeId } from '@/lib/adFormats';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { estimateImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { buildAdPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const estimateSchema = briefSchema.extend({
  sizeIds: z.array(z.string()).min(1).max(6),
  adCopy: z
    .object({
      headline: z.string().min(1).max(120),
      subhead: z.string().min(1).max(240),
      cta: z.string().max(48).optional(),
    })
    .nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = estimateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_brief' }, { status: 400 });
  }
  const { sizeIds, adCopy, ...brief } = parsed.data;
  const validSizeIds = [...new Set(sizeIds)].filter(isAdSizeId);
  if (validSizeIds.length === 0) {
    return NextResponse.json({ error: 'no_valid_sizes' }, { status: 400 });
  }

  // Brand is read for parity with cook; estimate cost does not depend on brand text.
  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  const perSize: Record<string, number> = {};
  let total = 0;
  await Promise.all(
    validSizeIds.map(async (sizeId) => {
      const size = AD_SIZES[sizeId]!;
      const enhanced = buildAdPrompt({ brief, brand, size, adCopy: adCopy ?? null });
      const input: VitrineImageGenInput = {
        prompt: resolveFinalPrompt(enhanced),
        aspectRatio: enhanced.aspectRatio,
        numImages: 1,
        resolution: '2K',
      };
      const snap = await estimateImageGen(session, input);
      const cost = snap.cost?.total ?? 0;
      perSize[sizeId] = cost;
      total += cost;
    }),
  );

  return NextResponse.json({ total, perSize });
}
