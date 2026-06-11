import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { estimateImageGen, OrchestratorError } from '@/lib/civitai';
import {
  isPhotoshootTemplateId,
  PHOTOSHOOT_TEMPLATES,
  type PhotoshootTemplateId,
} from '@/lib/photoshootTemplates';
import {
  buildPhotoshootPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const photoshootBriefSchema = z.object({
  productName: z.string().min(1).max(120),
  productNotes: z.string().min(1).max(2000),
  ratio: z.enum(['1:1', '4:5', '9:16']),
  variantsPerTemplate: z.number().int().min(1).max(8),
  templateIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPhotoshootTemplateId) as PhotoshootTemplateId[])
    .refine((ids) => ids.length >= 1, 'at least one valid template required'),
});

const previewBodySchema = z.object({
  brief: photoshootBriefSchema,
  templateIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPhotoshootTemplateId) as PhotoshootTemplateId[])
    .refine((ids) => ids.length >= 1, 'at least one valid template required'),
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
  const { brief, templateIds, referenceAssetIds } = parsed.data;

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

  // No buzz events recorded on preview — whatif estimates are free and stateless.
  await Promise.all(
    templateIds.map(async (id) => {
      const template = PHOTOSHOOT_TEMPLATES[id];
      const enhanced = buildPhotoshootPrompt({
        brief,
        brand,
        template,
        referenceCount: referenceUrls.length,
      });
      enhancedPrompts[id] = enhanced;
      try {
        const snap = await estimateImageGen(session, {
          prompt: resolveFinalPrompt(enhanced),
          ...(referenceUrls.length ? { images: referenceUrls } : {}),
          aspectRatio: enhanced.aspectRatio,
          numImages: brief.variantsPerTemplate,
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
