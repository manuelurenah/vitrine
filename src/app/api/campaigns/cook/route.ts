import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type AdCopy, generateAdCopyForPresets } from '@/lib/adCopy';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { recordBuzzEvent } from '@/lib/buzz';
import { createCampaign } from '@/lib/campaigns';
import {
  mapWithConcurrency,
  OrchestratorError,
  submitImageGen,
  type VitrineImageGenInput,
} from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { AD_STACK_COUNT, isAdPreset, isStackedPreset, PRESETS, type PresetId } from '@/lib/presets';
import { buildCampaignPrompt, type EnhancedPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { rateLimitOr429 } from '@/lib/rateLimitGuard';
import { getUserKey } from '@/lib/userKey';

const MAX_PROMPT_CHARS = 4000;

// Cap how many orchestrator submits are in flight at once. Firing all
// preset × variant submits simultaneously caused a fraction to transiently
// fail (rate-limit / 5xx) and get dropped. We bound concurrency to ease the
// load, but we deliberately do NOT retry: a silent re-submit could double-charge
// Buzz. Failed submits are persisted as visible `failed` tiles the user can
// manually regenerate instead.
const SUBMIT_CONCURRENCY_LIMIT = 6;

const enhancedPromptSchema = z.object({
  base: z.string().max(MAX_PROMPT_CHARS).optional(),
  brandLayer: z.string().max(MAX_PROMPT_CHARS).optional(),
  styleLayer: z.string().max(MAX_PROMPT_CHARS).optional(),
  finalPrompt: z.string().min(1).max(MAX_PROMPT_CHARS),
  negativePrompt: z.string().max(MAX_PROMPT_CHARS).default(''),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9', '8:1', '4:1', '5:4']),
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
  const limited = await rateLimitOr429(`cook:${userKey}`, 15, 60);
  if (limited) return limited;
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
      // Wide ad formats render each variant as a 3-banner stacked sheet (a
      // constant count, NOT the variant count) at a supported AR. Tile/job
      // count below still fans out to `variantsPerPreset` for every preset.
      ...(isStackedPreset(id) ? { stackCount: AD_STACK_COUNT } : {}),
      ...(provided?.userOverride ? { userOverride: provided.userOverride } : {}),
    });
    const finalPrompt = resolveFinalPrompt(enhanced);
    const input: VitrineImageGenInput = {
      prompt: finalPrompt,
      aspectRatio: enhanced.aspectRatio,
      numImages: 1,
      // Ad presets are center-cropped to exact pixel sizes; request more source
      // pixels so the crop stays sharp. Social presets keep the 1K default.
      ...(isAdPreset(id) ? { resolution: '2K' as const } : {}),
      ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
      ...(refUrls.length > 0 ? { images: refUrls } : {}),
    };
    return { id, adCopy, enhanced, finalPrompt, input, variantGroupId: randomUUID() };
  });

  // Flat list of (preset, variantIndex) submit jobs, preserving order so the
  // settled results line up with `submitMeta`. We do NOT pre-estimate
  // separately: submitImageGen returns the same cost.total whatif would.
  type SubmitJob = {
    presetId: PresetId;
    variantIndex: number;
    input: VitrineImageGenInput;
    finalPrompt: string;
    enhanced: EnhancedPrompt;
    adCopy: AdCopy | null;
    variantGroupId: string;
  };
  const jobs: SubmitJob[] = [];
  for (const p of perPreset) {
    for (let v = 0; v < variantsPerPreset; v++) {
      jobs.push({
        presetId: p.id,
        variantIndex: v,
        input: p.input,
        finalPrompt: p.finalPrompt,
        enhanced: p.enhanced,
        adCopy: p.adCopy,
        variantGroupId: p.variantGroupId,
      });
    }
  }

  // Bound how many submits are in flight. A single submit failure must not
  // poison the rest, and order is preserved so results stay aligned with
  // `submitMeta`. No retry: failures surface as persisted `failed` tiles below.
  const settled = await mapWithConcurrency(
    jobs,
    SUBMIT_CONCURRENCY_LIMIT,
    async (job): Promise<SubmittedTile> => {
      const submit = await submitImageGen(session, job.input);
      return {
        presetId: job.presetId,
        workflowId: submit.id,
        prompt: job.finalPrompt,
        estimatedCost: submit.cost?.total ?? 0,
        input: job.input,
        enhanced: job.enhanced,
        adCopy: job.adCopy,
        variantGroupId: job.variantGroupId,
        variantIndex: job.variantIndex,
      };
    },
  );

  // A submit that failed. We persist it as a `failed` tile so the user sees the
  // requested variant and can manually regenerate it (a retry here could
  // double-charge Buzz). `job` carries the same per-preset data the success path
  // uses (prompt, adCopy, variant group/index) so the failed tile is a faithful
  // placeholder for what was requested.
  type FailedTile = { job: SubmitJob; error: string; status?: number };

  const successes: SubmittedTile[] = [];
  const failures: FailedTile[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const job = jobs[i]!;
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      const reason: unknown = r.reason;
      failures.push({
        job,
        error: reason instanceof OrchestratorError ? 'orchestrator_error' : 'submit_failed',
        status: reason instanceof OrchestratorError ? reason.status : undefined,
      });
    }
  }

  if (successes.length === 0) {
    return NextResponse.json(
      { error: 'all_submits_failed', failures: failures.map((f) => ({ presetId: f.job.presetId, error: f.error, status: f.status })) },
      { status: failures[0]?.status && failures[0].status >= 400 ? failures[0].status : 502 },
    );
  }

  const estimatedBuzz = successes.reduce((sum, t) => sum + t.estimatedCost, 0);
  // Persist each preset's enhanced prompt so regenerate (including of a failed
  // tile) can reuse it. Include failed presets so a failed-only preset still has
  // its prompt on record.
  const enhancedRecord: Record<string, EnhancedPrompt> = {};
  for (const r of successes) enhancedRecord[r.presetId] = r.enhanced;
  for (const f of failures) enhancedRecord[f.job.presetId] ??= f.job.enhanced;

  // Successful tiles carry a real workflow id and cook; failed submits are
  // persisted as `failed` tiles (no workflow, no charge) so the user sees every
  // requested variant and can regenerate the failed ones manually.
  const successTiles = successes.map((r) => ({
    presetId: r.presetId,
    workflowId: r.workflowId as string | null,
    prompt: r.prompt,
    quantity: 1,
    variantGroupId: r.variantGroupId,
    variantIndex: r.variantIndex,
    adCopy: r.adCopy,
    status: 'cooking' as const,
  }));
  const failedTiles = failures.map((f) => ({
    presetId: f.job.presetId,
    workflowId: null,
    prompt: f.job.finalPrompt,
    quantity: 1,
    variantGroupId: f.job.variantGroupId,
    variantIndex: f.job.variantIndex,
    adCopy: f.job.adCopy,
    status: 'failed' as const,
    error: f.error,
  }));

  const campaign = await createCampaign({
    userId: userKey,
    title: brief.title,
    brief,
    presetIds: [...new Set([...successes, ...failures.map((f) => f.job)].map((r) => r.presetId))],
    referenceAssetIds,
    variantsPerPreset,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    tiles: [...successTiles, ...failedTiles],
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
    ...(failures.length > 0
      ? {
          partial: failures.map((f) => ({
            presetId: f.job.presetId,
            error: f.error,
            ...(f.status !== undefined ? { status: f.status } : {}),
          })),
        }
      : {}),
  });
}
