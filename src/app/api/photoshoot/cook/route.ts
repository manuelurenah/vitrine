import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { photoshootBriefSchema } from '@/lib/photoshootSchema';
import { createPhotoshoot } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES, type PhotoshootTemplateId } from '@/lib/photoshootTemplates';
import {
  buildPhotoshootPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const MAX_PROMPT_CHARS = 4000;

const enhancedPromptSchema = z.object({
  base: z.string().max(MAX_PROMPT_CHARS).optional(),
  brandLayer: z.string().max(MAX_PROMPT_CHARS).optional(),
  styleLayer: z.string().max(MAX_PROMPT_CHARS).optional(),
  finalPrompt: z.string().min(1).max(MAX_PROMPT_CHARS),
  negativePrompt: z.string().max(MAX_PROMPT_CHARS).default(''),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']),
  userOverride: z.string().max(MAX_PROMPT_CHARS).optional(),
});

const cookSchema = photoshootBriefSchema.extend({
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  enhancedPrompts: z.record(z.string(), enhancedPromptSchema).optional(),
});

type SubmittedTile = {
  templateId: PhotoshootTemplateId;
  workflowId: string;
  prompt: string;
  estimatedCost: number;
  input: VitrineImageGenInput;
  enhanced: EnhancedPrompt;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = cookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_brief', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const { referenceAssetIds, enhancedPrompts: clientEnhanced, ...brief } = body;

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  let refUrls: string[];
  try {
    refUrls = referenceAssetIds.length > 0 ? await getPublicUrls(userKey, referenceAssetIds) : [];
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const settled = await Promise.allSettled(
    brief.templateIds.map(async (templateId): Promise<SubmittedTile> => {
      const template = PHOTOSHOOT_TEMPLATES[templateId];
      const provided = clientEnhanced?.[templateId];
      const enhanced: EnhancedPrompt = provided
        ? {
            base: provided.base ?? '',
            brandLayer: provided.brandLayer ?? '',
            styleLayer: provided.styleLayer ?? '',
            finalPrompt: provided.finalPrompt,
            negativePrompt: provided.negativePrompt ?? '',
            aspectRatio: provided.aspectRatio,
            userOverride: provided.userOverride,
          }
        : buildPhotoshootPrompt({
            brief,
            brand,
            template,
            referenceCount: refUrls.length,
          });
      const finalPrompt = resolveFinalPrompt(enhanced);
      const input: VitrineImageGenInput = {
        prompt: finalPrompt,
        aspectRatio: enhanced.aspectRatio,
        numImages: brief.variantsPerTemplate,
        ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
        ...(refUrls.length > 0 ? { images: refUrls } : {}),
      };
      const submit = await submitImageGen(session, input);
      return {
        templateId,
        workflowId: submit.id,
        prompt: finalPrompt,
        estimatedCost: submit.cost?.total ?? 0,
        input,
        enhanced,
      };
    }),
  );

  const successes: SubmittedTile[] = [];
  const failures: Array<{ templateId: PhotoshootTemplateId; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const templateId = brief.templateIds[i]!;
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      const reason: unknown = r.reason;
      failures.push({
        templateId,
        error: reason instanceof OrchestratorError ? 'orchestrator_error' : 'submit_failed',
        status: reason instanceof OrchestratorError ? reason.status : undefined,
      });
    }
  }

  if (successes.length === 0) {
    return NextResponse.json(
      { error: 'all_submits_failed', failures },
      { status: failures[0]?.status && failures[0].status >= 400 ? failures[0].status : 502 },
    );
  }

  const estimatedBuzz = successes.reduce((sum, t) => sum + t.estimatedCost, 0);
  const enhancedRecord: Record<string, EnhancedPrompt> = {};
  for (const r of successes) enhancedRecord[r.templateId] = r.enhanced;

  const shoot = await createPhotoshoot({
    userId: userKey,
    title: brief.productName,
    brief: { ...brief, templateIds: successes.map((r) => r.templateId) },
    referenceAssetIds,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    tiles: successes.map((r) => ({
      templateId: r.templateId,
      variantIndex: 0,
      workflowId: r.workflowId,
      prompt: r.prompt,
      quantity: brief.variantsPerTemplate,
    })),
    estimatedBuzz,
  });

  await Promise.all(
    successes.map(async (r) => {
      const tile = shoot.tiles.find((t) => t.workflowId === r.workflowId);
      await Promise.all([
        recordGeneration({
          workflowId: r.workflowId,
          userId: userKey,
          source: 'photoshoot',
          sourceId: shoot.id,
          tileId: tile?.id,
          prompt: r.prompt,
          input: r.input as unknown as Record<string, unknown>,
          estimatedBuzz: r.estimatedCost,
        }),
        recordBuzzEvent({
          userId: userKey,
          workflowId: r.workflowId,
          kind: 'estimate',
          estimated: r.estimatedCost,
          note: 'cook',
        }),
      ]);
    }),
  );

  return NextResponse.json({
    photoshootId: shoot.id,
    ...(failures.length > 0 ? { partial: failures } : {}),
  });
}
