import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { getCampaign, swapTileWorkflow } from '@/lib/campaigns';
import { OrchestratorError, submitImageGen } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { buildTileRegenInput } from '@/lib/regenerateInput';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z
  .object({
    promptHint: z.string().max(400).optional(),
    relayout: z.boolean().optional(),
    /** Palette override (hex strings) applied to this generation only. */
    palette: z.array(z.string().max(9)).max(8).optional(),
    /** Include the brand logo in the generation. */
    includeLogo: z.boolean().optional(),
  })
  .optional();

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

  const palette = parsedBody.success ? parsedBody.data?.palette : undefined;
  const includeLogo = parsedBody.success ? (parsedBody.data?.includeLogo ?? false) : false;
  const variation = Math.floor(Math.random() * 1000);

  const { input, prompt: promptWithVariation } = buildTileRegenInput({
    campaign,
    tile,
    brand,
    refUrls,
    variantsPerPreset: campaign.variantsPerPreset,
    options: {
      relayout,
      ...(promptHint ? { promptHint } : {}),
      ...(palette && palette.length > 0 ? { paletteOverride: palette } : {}),
      includeLogo,
      ...(includeLogo ? { logoUrl: brand?.logoUrl ?? null } : {}),
      variation,
    },
  });

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
