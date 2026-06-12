import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { getCampaign, swapTileWorkflow } from '@/lib/campaigns';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { PRESETS } from '@/lib/presets';
import { buildCampaignPrompt, type EnhancedPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z
  .object({
    promptHint: z.string().max(400).optional(),
    /** Fix-layout: re-edit the tile's current creative instead of the product refs. */
    relayout: z.boolean().optional(),
  })
  .optional();

function isEnhancedPrompt(value: unknown): value is EnhancedPrompt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.finalPrompt === 'string' && typeof v.aspectRatio === 'string';
}

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const rawBody = await req.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(rawBody);
  const promptHint = parsedBody.success ? parsedBody.data?.promptHint : undefined;
  const relayout = parsedBody.success ? (parsedBody.data?.relayout ?? false) : false;

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

  // Fix-layout re-balances the EXISTING creative, so it must edit the tile's
  // current generated image — not the original product reference, which would
  // throw away the cooked scene and revert the background to the raw product
  // photo. Plain regenerate keeps using the product refs for a fresh variation.
  const editImages = relayout && tile.assetUrl ? [tile.assetUrl] : refUrls;

  // When the tile has ad copy, rebuild from the brief so the render directives
  // (which live inside finalPrompt) stay current with the stored copy.
  // Otherwise reuse the original persisted enhanced prompt for stable variation.
  const persisted = campaign.enhancedPrompts?.[tile.presetId];
  const enhanced: EnhancedPrompt = tile.adCopy
    ? buildCampaignPrompt({
        brief: campaign.brief,
        brand,
        preset,
        referenceCount: editImages.length,
        adCopy: tile.adCopy,
      })
    : isEnhancedPrompt(persisted)
      ? persisted
      : buildCampaignPrompt({
          brief: campaign.brief,
          brand,
          preset,
          referenceCount: editImages.length,
        });

  const variation = Math.floor(Math.random() * 1000);
  const basePrompt = resolveFinalPrompt(enhanced);
  const baseWithHint = promptHint ? `${basePrompt}\n\n${promptHint}` : basePrompt;
  const promptWithVariation = `${baseWithHint} · variation ${variation}`;

  const quantity = tile.quantity ?? campaign.variantsPerPreset ?? 1;

  const input: VitrineImageGenInput = {
    prompt: promptWithVariation,
    aspectRatio: enhanced.aspectRatio,
    numImages: quantity,
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(editImages.length > 0 ? { images: editImages } : {}),
  };

  try {
    const snap = await submitImageGen(session, input);
    const updated = await swapTileWorkflow(userKey, id, tileId, snap.id, {
      prompt: promptWithVariation,
    });
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
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    return NextResponse.json({ error: 'submit_failed' }, { status: 502 });
  }
}
