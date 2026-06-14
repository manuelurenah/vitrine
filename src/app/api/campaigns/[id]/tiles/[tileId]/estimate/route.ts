import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { getCampaign } from '@/lib/campaigns';
import { estimateImageGen, OrchestratorError } from '@/lib/civitai';
import { buildTileRegenInput } from '@/lib/regenerateInput';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z
  .object({
    relayout: z.boolean().optional(),
    promptHint: z.string().max(400).optional(),
    palette: z.array(z.string().max(9)).max(8).optional(),
    includeLogo: z.boolean().optional(),
  })
  .optional();

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const opts = parsed.success ? (parsed.data ?? {}) : {};

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
      return NextResponse.json({ error: 'invalid_reference_assets' }, { status: 400 });
    }
    throw err;
  }

  const includeLogo = opts.includeLogo ?? false;
  const { input } = buildTileRegenInput({
    campaign,
    tile,
    brand,
    refUrls,
    variantsPerPreset: campaign.variantsPerPreset,
    options: {
      relayout: opts.relayout ?? false,
      ...(opts.promptHint ? { promptHint: opts.promptHint } : {}),
      ...(opts.palette && opts.palette.length > 0 ? { paletteOverride: opts.palette } : {}),
      includeLogo,
      ...(includeLogo ? { logoUrl: brand?.logoUrl ?? null } : {}),
      variation: null,
    },
  });

  try {
    const snap = await estimateImageGen(session, input);
    return NextResponse.json({ cost: snap.cost?.total ?? 0 });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    return NextResponse.json({ error: 'estimate_failed' }, { status: 502 });
  }
}
