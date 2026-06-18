import { type NextRequest, NextResponse } from 'next/server';
import { MissingReferenceError, getPublicUrls } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { regeneratePhotoshootTile } from '@/lib/photoshootCook';
import { getPhotoshoot } from '@/lib/photoshoots';
import { isPhotoshootTemplateId, PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';
import {
  buildPhotoshootPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { rateLimitOr429 } from '@/lib/rateLimitGuard';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; templateId: string }>;

function isEnhancedPrompt(value: unknown): value is EnhancedPrompt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.finalPrompt === 'string' && typeof v.aspectRatio === 'string';
}

export async function POST(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const limited = await rateLimitOr429(`regen:${userKey}`, 30, 60);
  if (limited) return limited;
  const { id, templateId } = await ctx.params;

  if (!isPhotoshootTemplateId(templateId)) {
    return NextResponse.json({ error: 'invalid_template_id' }, { status: 400 });
  }

  const shoot = await getPhotoshoot(userKey, id);
  if (!shoot) return NextResponse.json({ error: 'photoshoot_not_found' }, { status: 404 });

  const templateTiles = shoot.tiles.filter((t) => t.templateId === templateId);
  if (templateTiles.length === 0) {
    return NextResponse.json({ error: 'template_tiles_not_found' }, { status: 404 });
  }

  const template = PHOTOSHOOT_TEMPLATES[templateId];
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

  const persisted = shoot.enhancedPrompts?.[templateId];
  const enhanced: EnhancedPrompt = isEnhancedPrompt(persisted)
    ? persisted
    : buildPhotoshootPrompt({
        brief: shoot.brief,
        brand,
        template,
        referenceCount: refUrls.length,
      });

  const basePrompt = resolveFinalPrompt(enhanced);

  // Submit a fresh workflow for each tile in this template group in parallel,
  // using a shared variation seed so all variants in this regeneration feel cohesive.
  const variation = Math.floor(Math.random() * 1000);
  const promptWithVariation = `${basePrompt} · variation ${variation}`;

  const settled = await Promise.allSettled(
    templateTiles.map(async (tile) => {
      const quantity = tile.quantity ?? shoot.brief.variantsPerTemplate ?? 1;
      const input = {
        prompt: promptWithVariation,
        aspectRatio: enhanced.aspectRatio,
        numImages: quantity,
        ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
        ...(refUrls.length > 0 ? { images: refUrls } : {}),
      };

      const result = await regeneratePhotoshootTile({
        session,
        userId: userKey,
        photoshootId: id,
        tileId: tile.id,
        input,
        prompt: promptWithVariation,
      });

      if (!result.ok) {
        throw Object.assign(new Error(result.error), { httpStatus: result.status });
      }

      return result;
    }),
  );

  type Success = { id: string; templateId: string; workflowId: string; status: string };
  const tiles: Success[] = [];
  const partial: Array<{ tileId: string; error: string }> = [];

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const tile = templateTiles[i]!;
    if (r.status === 'fulfilled') {
      tiles.push({
        id: tile.id,
        templateId,
        workflowId: r.value.workflowId,
        status: 'cooking',
      });
    } else {
      const reason = r.reason as Error & { httpStatus?: number };
      partial.push({ tileId: tile.id, error: reason.message ?? 'submit_failed' });
    }
  }

  if (tiles.length === 0) {
    const firstReason = (settled[0] as PromiseRejectedResult).reason as Error & {
      httpStatus?: number;
    };
    return NextResponse.json(
      { error: 'all_submits_failed', partial },
      { status: firstReason.httpStatus ?? 502 },
    );
  }

  return NextResponse.json({
    tiles,
    ...(partial.length > 0 ? { partial } : {}),
  });
}
