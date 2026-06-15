import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type AdCopy, generateAdCopyForPresets } from '@/lib/adCopy';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { recordBuzzEvent } from '@/lib/buzz';
import { createCampaign } from '@/lib/campaigns';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { PRESETS, type PresetId } from '@/lib/presets';
import { buildCampaignPrompt, type EnhancedPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
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

const adCopySchema = z.object({
  headline: z.string().min(1).max(120),
  subhead: z.string().min(1).max(240),
  cta: z.string().max(48).optional(),
});

const cookSchema = briefSchema.extend({
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  variantsPerPreset: z.number().int().min(1).max(8).default(1),
  enhancedPrompts: z.record(z.string(), enhancedPromptSchema).optional(),
  adCopy: z.record(z.string(), adCopySchema).optional(),
});

type SubmittedTile = {
  presetId: PresetId;
  workflowId: string;
  prompt: string;
  estimatedCost: number;
  input: VitrineImageGenInput;
  enhanced: EnhancedPrompt;
  adCopy: AdCopy | null;
  variantGroupId: string;
  variantIndex: number;
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
  const {
    referenceAssetIds,
    variantsPerPreset,
    enhancedPrompts: clientEnhanced,
    adCopy: clientAdCopy,
    ...brief
  } = body;

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  // Prefer the ad copy already prepared by the wizard (draft step). Only call
  // the LLM here when the wizard didn't supply it — keeps the cook path fast
  // and avoids a redundant second LLM call.
  const hasClientCopy = !!clientAdCopy && brief.presetIds.every((id) => clientAdCopy[id]);
  const adCopyMap = hasClientCopy
    ? (clientAdCopy as Record<PresetId, AdCopy>)
    : await generateAdCopyForPresets({
        brief,
        brand,
        presetIds: brief.presetIds,
      });

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

  // Build each preset's prompt + ad copy ONCE, then fan out N single-image
  // submits per preset. Each variant becomes its own quantity-1 tile sharing a
  // variant_group_id, so it can be edited / regenerated independently.
  //
  // We always rebuild the prompt with adCopy so the headline/subhead/CTA render
  // directives reach the model. The client enhancedPrompts come from /preview,
  // which builds WITHOUT adCopy (so its finalPrompt actively says "no text
  // overlay"); submitting it verbatim is why cooked images had no baked-in text
  // until "fix layout". We only carry over the user's manual prompt override
  // from the wizard. Mirrors the regenerate route.
  const perPreset = brief.presetIds.map((id) => {
    const preset = PRESETS[id];
    const adCopy = adCopyMap[id] ?? null;
    const provided = clientEnhanced?.[id];
    const enhanced: EnhancedPrompt = buildCampaignPrompt({
      brief,
      brand,
      preset,
      referenceCount: refUrls.length,
      adCopy,
      ...(provided?.userOverride ? { userOverride: provided.userOverride } : {}),
    });
    const finalPrompt = resolveFinalPrompt(enhanced);
    const input: VitrineImageGenInput = {
      prompt: finalPrompt,
      aspectRatio: enhanced.aspectRatio,
      numImages: 1,
      ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
      ...(refUrls.length > 0 ? { images: refUrls } : {}),
    };
    return { id, adCopy, enhanced, finalPrompt, input, variantGroupId: randomUUID() };
  });

  // Flat list of (preset, variantIndex) submit jobs, preserving order so the
  // settled results line up with `submitMeta`. A single submit failure
  // shouldn't poison the rest. We do NOT pre-estimate separately:
  // submitImageGen returns the same cost.total whatif would.
  const submitMeta: Array<{ presetId: PresetId; variantIndex: number }> = [];
  const submitPromises: Array<Promise<SubmittedTile>> = [];
  for (const p of perPreset) {
    for (let v = 0; v < variantsPerPreset; v++) {
      submitMeta.push({ presetId: p.id, variantIndex: v });
      submitPromises.push(
        (async (): Promise<SubmittedTile> => {
          const submit = await submitImageGen(session, p.input);
          return {
            presetId: p.id,
            workflowId: submit.id,
            prompt: p.finalPrompt,
            estimatedCost: submit.cost?.total ?? 0,
            input: p.input,
            enhanced: p.enhanced,
            adCopy: p.adCopy,
            variantGroupId: p.variantGroupId,
            variantIndex: v,
          };
        })(),
      );
    }
  }
  const settled = await Promise.allSettled(submitPromises);

  const successes: SubmittedTile[] = [];
  const failures: Array<{ presetId: PresetId; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const presetId = submitMeta[i]!.presetId;
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
    presetIds: [...new Set(successes.map((r) => r.presetId))],
    referenceAssetIds,
    variantsPerPreset,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    tiles: successes.map((r) => ({
      presetId: r.presetId,
      workflowId: r.workflowId,
      prompt: r.prompt,
      quantity: 1,
      variantGroupId: r.variantGroupId,
      variantIndex: r.variantIndex,
      adCopy: r.adCopy,
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
