import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  OrchestratorError,
  submitImageGen,
  type VitrineImageGenInput,
} from '@/lib/civitai';
import { briefSchema } from '@/lib/briefSchema';
import { PRESETS, type PresetId } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { createCampaign } from '@/lib/campaigns';
import { recordGeneration } from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';
import { getDefaultBrand } from '@/lib/brand';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import {
  buildCampaignPrompt,
  resolveFinalPrompt,
  type EnhancedPrompt,
} from '@/lib/promptBuilder';

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

const cookSchema = briefSchema.extend({
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  variantsPerPreset: z.number().int().min(1).max(8).default(1),
  enhancedPrompts: z.record(z.string(), enhancedPromptSchema).optional(),
});

type SubmittedTile = {
  presetId: PresetId;
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
  const { referenceAssetIds, variantsPerPreset, enhancedPrompts: clientEnhanced, ...brief } = body;

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

  // Submit each preset's workflow independently — a single preset failure
  // shouldn't poison the rest. Successful submissions get persisted; failures
  // are reported back so the UI can surface them. We do NOT pre-estimate
  // separately: submitImageGen returns the same cost.total whatif would.
  const settled = await Promise.allSettled(
    brief.presetIds.map(async (id): Promise<SubmittedTile> => {
      const preset = PRESETS[id];
      const provided = clientEnhanced?.[id];
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
        : buildCampaignPrompt({
            brief,
            brand,
            preset,
            referenceCount: refUrls.length,
          });
      const finalPrompt = resolveFinalPrompt(enhanced);
      const input: VitrineImageGenInput = {
        prompt: finalPrompt,
        aspectRatio: enhanced.aspectRatio,
        numImages: variantsPerPreset,
        ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
        ...(refUrls.length > 0 ? { images: refUrls } : {}),
      };
      const submit = await submitImageGen(session, input);
      return {
        presetId: id,
        workflowId: submit.id,
        prompt: finalPrompt,
        estimatedCost: submit.cost?.total ?? 0,
        input,
        enhanced,
      };
    }),
  );

  const successes: SubmittedTile[] = [];
  const failures: Array<{ presetId: PresetId; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const presetId = brief.presetIds[i]!;
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      const reason: unknown = r.reason;
      failures.push({
        presetId,
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
  for (const r of successes) enhancedRecord[r.presetId] = r.enhanced;

  const campaign = await createCampaign({
    userId: userKey,
    title: brief.title,
    brief,
    presetIds: successes.map((r) => r.presetId),
    referenceAssetIds,
    variantsPerPreset,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    tiles: successes.map((r) => ({
      presetId: r.presetId,
      workflowId: r.workflowId,
      prompt: r.prompt,
      quantity: variantsPerPreset,
    })),
    estimatedBuzz,
    audience: brief.audience?.trim() || null,
    aesthetics: brief.aesthetics?.trim() || null,
  });

  // Batch the audit writes per success — one round trip per row category.
  // The `kind: 'submit'` event is recorded in the workflow polling endpoint
  // when terminal status arrives and the real `charged` cost is known. We
  // only emit `kind: 'estimate'` here (intent-to-charge at cook time).
  await Promise.all(
    successes.map(async (r) => {
      const tile = campaign.tiles.find((t) => t.workflowId === r.workflowId);
      await Promise.all([
        recordGeneration({
          workflowId: r.workflowId,
          userId: userKey,
          source: 'campaign',
          sourceId: campaign.id,
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
    campaignId: campaign.id,
    ...(failures.length > 0 ? { partial: failures } : {}),
  });
}
