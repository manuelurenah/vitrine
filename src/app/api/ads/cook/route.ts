import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdCopy } from '@/lib/adCopy';
import { createAdCampaign } from '@/lib/adCampaigns';
import { AD_SIZES, isAdSizeId } from '@/lib/adFormats';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { buildAdPrompt, type EnhancedPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const adCopySchema = z.object({
  headline: z.string().min(1).max(120),
  subhead: z.string().min(1).max(240),
  cta: z.string().max(48).optional(),
});

const cookSchema = briefSchema.omit({ presetIds: true }).extend({
  sizeIds: z.array(z.string()).min(1).max(6),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  adCopy: adCopySchema.nullish(),
});

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
  const { sizeIds, referenceAssetIds, adCopy, ...brief } = parsed.data;

  const validSizeIds = [...new Set(sizeIds)].filter(isAdSizeId);
  if (validSizeIds.length === 0) {
    return NextResponse.json({ error: 'no_valid_sizes' }, { status: 400 });
  }

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

  const adCopyVal: AdCopy | null = adCopy ?? null;

  const perSize = validSizeIds.map((sizeId) => {
    const size = AD_SIZES[sizeId]!;
    const enhanced = buildAdPrompt({
      brief,
      brand,
      size,
      referenceCount: refUrls.length,
      adCopy: adCopyVal,
    });
    const finalPrompt = resolveFinalPrompt(enhanced);
    const input: VitrineImageGenInput = {
      prompt: finalPrompt,
      aspectRatio: enhanced.aspectRatio,
      numImages: 1,
      resolution: '2K',
      ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
      ...(refUrls.length > 0 ? { images: refUrls } : {}),
    };
    return { size, enhanced, finalPrompt, input };
  });

  const submitMeta = perSize.map((p) => p.size.id);
  const settled = await Promise.allSettled(
    perSize.map(async (p) => {
      const submit = await submitImageGen(session, p.input);
      return {
        size: p.size,
        workflowId: submit.id,
        prompt: p.finalPrompt,
        estimatedCost: submit.cost?.total ?? 0,
        input: p.input,
        enhanced: p.enhanced,
      };
    }),
  );

  const successes: Array<{
    size: (typeof perSize)[number]['size'];
    workflowId: string;
    prompt: string;
    estimatedCost: number;
    input: VitrineImageGenInput;
    enhanced: EnhancedPrompt;
  }> = [];
  const failures: Array<{ sizeId: string; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const sizeId = submitMeta[i]!;
    if (r.status === 'fulfilled') successes.push(r.value);
    else {
      const reason: unknown = r.reason;
      failures.push({
        sizeId,
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

  const estimatedBuzz = successes.reduce((sum, s) => sum + s.estimatedCost, 0);
  const enhancedRecord: Record<string, EnhancedPrompt> = {};
  for (const s of successes) enhancedRecord[s.size.id] = s.enhanced;

  const campaign = await createAdCampaign({
    userId: userKey,
    title: brief.title,
    brief,
    sizeIds: successes.map((s) => s.size.id),
    referenceAssetIds,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    adCopy: adCopyVal,
    audience: brief.audience?.trim() || null,
    aesthetics: brief.aesthetics?.trim() || null,
    estimatedBuzz,
    tiles: successes.map((s) => ({
      sizeId: s.size.id,
      width: s.size.width,
      height: s.size.height,
      aspectRatio: s.size.aspectRatio,
      workflowId: s.workflowId,
      prompt: s.prompt,
      adCopy: adCopyVal,
    })),
  });

  await Promise.all(
    successes.map(async (s) => {
      const tile = campaign.tiles.find((t) => t.workflowId === s.workflowId);
      await Promise.all([
        recordGeneration({
          workflowId: s.workflowId,
          userId: userKey,
          source: 'ad_campaign',
          sourceId: campaign.id,
          tileId: tile?.id,
          prompt: s.prompt,
          input: s.input as unknown as Record<string, unknown>,
          estimatedBuzz: s.estimatedCost,
        }),
        recordBuzzEvent({
          userId: userKey,
          workflowId: s.workflowId,
          kind: 'estimate',
          estimated: s.estimatedCost,
          note: 'cook',
        }),
      ]);
    }),
  );

  return NextResponse.json({
    adCampaignId: campaign.id,
    ...(failures.length > 0 ? { partial: failures } : {}),
  });
}
