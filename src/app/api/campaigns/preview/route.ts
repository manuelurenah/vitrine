import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { estimateImageGen, OrchestratorError } from '@/lib/civitai';
import { isPresetId, PRESETS, type PresetId } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getDefaultBrand } from '@/lib/brand';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { buildCampaignPrompt, resolveFinalPrompt, type EnhancedPrompt } from '@/lib/promptBuilder';

const briefForPresetsSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  goal: z.string().max(120).default(''),
  offer: z.string().max(120).default(''),
  prompt: z.string().max(2000).default(''),
  audience: z.string().max(500).optional(),
  aesthetics: z.string().max(500).optional(),
});

const previewBodySchema = z.object({
  brief: briefForPresetsSchema,
  presetIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPresetId) as PresetId[])
    .refine((ids) => ids.length >= 1, 'at least one valid preset required'),
  variantsPerPreset: z.number().int().min(1).max(8),
  referenceAssetIds: z.array(z.string()).default([]),
});

type PreviewResponse = {
  enhancedPrompts: Record<string, EnhancedPrompt>;
  estimatePerPreset: Record<string, number>;
  totalBuzz: number;
  errors?: Record<string, string>;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = previewBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { brief, presetIds, variantsPerPreset, referenceAssetIds } = parsed.data;

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  let referenceUrls: string[];
  try {
    referenceUrls = await getPublicUrls(userKey, referenceAssetIds);
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const enhancedPrompts: Record<string, EnhancedPrompt> = {};
  const estimatePerPreset: Record<string, number> = {};
  const errors: Record<string, string> = {};

  // No buzz events recorded on preview — they're written at cook time with a
  // real workflow_id. Whatif estimates are free and stateless.
  await Promise.all(
    presetIds.map(async (id) => {
      const preset = PRESETS[id];
      const enhanced = buildCampaignPrompt({
        brief,
        brand,
        preset,
        referenceCount: referenceUrls.length,
      });
      enhancedPrompts[id] = enhanced;
      try {
        const snap = await estimateImageGen(session, {
          prompt: resolveFinalPrompt(enhanced),
          ...(referenceUrls.length ? { images: referenceUrls } : {}),
          aspectRatio: enhanced.aspectRatio,
          numImages: variantsPerPreset,
          negativePrompt: enhanced.negativePrompt,
        });
        estimatePerPreset[id] = snap.cost?.total ?? 0;
      } catch (err) {
        estimatePerPreset[id] = 0;
        if (err instanceof OrchestratorError) {
          errors[id] = `orchestrator_error:${err.status}`;
        } else {
          errors[id] = 'estimate_failed';
        }
      }
    }),
  );

  const totalBuzz = Object.values(estimatePerPreset).reduce((sum, n) => sum + n, 0);

  const response: PreviewResponse = { enhancedPrompts, estimatePerPreset, totalBuzz };
  if (Object.keys(errors).length > 0) response.errors = errors;
  return NextResponse.json(response);
}
