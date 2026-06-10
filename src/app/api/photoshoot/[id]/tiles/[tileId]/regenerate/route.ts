import { type NextRequest, NextResponse } from 'next/server';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { getPhotoshoot, swapPhotoshootTileWorkflow } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';
import {
  buildPhotoshootPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

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
  const shoot = await getPhotoshoot(userKey, id);
  if (!shoot) return NextResponse.json({ error: 'photoshoot_not_found' }, { status: 404 });
  const tile = shoot.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const template = PHOTOSHOOT_TEMPLATES[tile.templateId];
  const brand = await getDefaultBrand(userKey);

  let refUrls: string[];
  try {
    refUrls =
      shoot.referenceAssetIds.length > 0
        ? await getPublicUrls(userKey, shoot.referenceAssetIds)
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

  const persisted = shoot.enhancedPrompts?.[tile.templateId];
  const enhanced: EnhancedPrompt = isEnhancedPrompt(persisted)
    ? persisted
    : buildPhotoshootPrompt({
        brief: shoot.brief,
        brand,
        template,
        referenceCount: refUrls.length,
      });

  const variation = Math.floor(Math.random() * 1000);
  const basePrompt = resolveFinalPrompt(enhanced);
  const promptWithVariation = `${basePrompt} · variation ${variation}`;

  const quantity = tile.quantity ?? shoot.brief.variantsPerTemplate ?? 1;

  const input: VitrineImageGenInput = {
    prompt: promptWithVariation,
    aspectRatio: enhanced.aspectRatio,
    numImages: quantity,
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(refUrls.length > 0 ? { images: refUrls } : {}),
  };

  try {
    const snap = await submitImageGen(session, input);
    const updated = await swapPhotoshootTileWorkflow(userKey, id, tileId, snap.id);
    await recordGeneration({
      workflowId: snap.id,
      userId: userKey,
      source: 'photoshoot',
      sourceId: id,
      tileId,
      prompt: promptWithVariation,
      input: input as unknown as Record<string, unknown>,
      estimatedBuzz: snap.cost?.total ?? 0,
    });
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
