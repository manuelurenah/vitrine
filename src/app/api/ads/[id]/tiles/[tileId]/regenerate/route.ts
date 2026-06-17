import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdCampaign, swapAdTileWorkflow } from '@/lib/adCampaigns';
import { AD_SIZES } from '@/lib/adFormats';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { buildAdPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z.object({
  promptHint: z.string().max(2000).optional(),
  prompt: z.string().max(4000).optional(),
  adCopy: z
    .object({
      headline: z.string().min(1).max(120),
      subhead: z.string().min(1).max(240),
      cta: z.string().max(48).optional(),
    })
    .nullish(),
});

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const size = AD_SIZES[tile.sizeId];
  if (!size) return NextResponse.json({ error: 'unknown_size' }, { status: 400 });

  const brand = await getDefaultBrand(userKey);

  let refUrls: string[] = [];
  try {
    refUrls =
      campaign.referenceAssetIds.length > 0
        ? await getPublicUrls(userKey, campaign.referenceAssetIds)
        : [];
  } catch (err) {
    if (!(err instanceof MissingReferenceError)) throw err;
  }

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  const { promptHint, prompt: promptOverride, adCopy } = body.success ? body.data : {};

  const enhanced = buildAdPrompt({
    brief: campaign.brief,
    brand,
    size,
    referenceCount: refUrls.length,
    adCopy: adCopy ?? campaign.adCopy ?? null,
    ...(promptOverride ? { userOverride: promptOverride } : {}),
  });
  const basePrompt = resolveFinalPrompt(enhanced);
  const finalPrompt = promptHint ? `${basePrompt}. ${promptHint}` : basePrompt;

  const input: VitrineImageGenInput = {
    prompt: finalPrompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: 1,
    resolution: '2K',
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(refUrls.length > 0 ? { images: refUrls } : {}),
  };

  let workflowId: string;
  let estimatedCost = 0;
  try {
    const submit = await submitImageGen(session, input);
    workflowId = submit.id;
    estimatedCost = submit.cost?.total ?? 0;
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    throw err;
  }

  const updated = await swapAdTileWorkflow(userKey, id, tileId, workflowId, {
    prompt: finalPrompt,
    adCopy: adCopy ?? campaign.adCopy ?? null,
  });

  await Promise.all([
    recordGeneration({
      workflowId,
      userId: userKey,
      source: 'ad_campaign',
      sourceId: id,
      tileId,
      prompt: finalPrompt,
      input: input as unknown as Record<string, unknown>,
      estimatedBuzz: estimatedCost,
    }),
    recordBuzzEvent({
      userId: userKey,
      workflowId,
      kind: 'estimate',
      estimated: estimatedCost,
      note: 'regenerate',
    }),
  ]);

  return NextResponse.json({ tile: updated, workflowId });
}
