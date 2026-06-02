import { NextResponse, type NextRequest } from 'next/server';
import {
  OrchestratorError,
  submitImageGen,
  type VitrineImageGenInput,
} from '@/lib/civitai';
import { getCampaign, swapTileWorkflow } from '@/lib/campaigns';
import { PRESETS } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { recordGeneration } from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';
import { getDefaultBrand } from '@/lib/brand';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import {
  buildCampaignPrompt,
  resolveFinalPrompt,
  type EnhancedPrompt,
} from '@/lib/promptBuilder';

type Params = Promise<{ id: string; tileId: string }>;

function isEnhancedPrompt(value: unknown): value is EnhancedPrompt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.finalPrompt === 'string' && typeof v.aspectRatio === 'string';
}

export async function POST(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;
  const campaign = await getCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const preset = PRESETS[tile.presetId];
  const brand = await getDefaultBrand(userKey);

  let refUrls: string[];
  try {
    refUrls =
      campaign.referenceAssetIds.length > 0
        ? await getPublicUrls(userKey, campaign.referenceAssetIds)
        : [];
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const persisted = campaign.enhancedPrompts?.[tile.presetId];
  const enhanced: EnhancedPrompt = isEnhancedPrompt(persisted)
    ? persisted
    : buildCampaignPrompt({
        brief: campaign.brief,
        brand,
        preset,
        referenceCount: refUrls.length,
      });

  const variation = Math.floor(Math.random() * 1000);
  const basePrompt = resolveFinalPrompt(enhanced);
  const promptWithVariation = `${basePrompt} · variation ${variation}`;

  const quantity = tile.quantity ?? campaign.variantsPerPreset ?? 1;

  const input: VitrineImageGenInput = {
    prompt: promptWithVariation,
    aspectRatio: enhanced.aspectRatio,
    numImages: quantity,
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(refUrls.length > 0 ? { images: refUrls } : {}),
  };

  try {
    const snap = await submitImageGen(session, input);
    const updated = await swapTileWorkflow(userKey, id, tileId, snap.id);
    await recordGeneration({
      workflowId: snap.id,
      userId: userKey,
      source: 'campaign',
      sourceId: id,
      tileId,
      prompt: promptWithVariation,
      input: input as unknown as Record<string, unknown>,
      estimatedBuzz: snap.cost?.total ?? 0,
    });
    // `kind: 'submit'` is emitted by the workflow polling endpoint on terminal
    // success with the real charged cost. Cook time only records `estimate`.
    await recordBuzzEvent({
      userId: userKey,
      workflowId: snap.id,
      kind: 'estimate',
      estimated: snap.cost?.total ?? 0,
      note: 'regenerate',
    });
    return NextResponse.json({ tile: updated, workflowId: snap.id });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json(
        { error: 'orchestrator_error' },
        { status: err.status },
      );
    }
    return NextResponse.json({ error: 'submit_failed' }, { status: 502 });
  }
}
