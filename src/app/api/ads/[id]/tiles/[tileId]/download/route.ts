import { type NextRequest, NextResponse } from 'next/server';
import { getAdCampaign } from '@/lib/adCampaigns';
import { cropToExactPng } from '@/lib/adExport';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'ad';
}

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });
  if (tile.status !== 'done' || !tile.assetUrl) {
    return NextResponse.json({ error: 'not_ready' }, { status: 409 });
  }

  let res: Response;
  try {
    res = await fetch(tile.assetUrl);
  } catch (err) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  if (!res.ok) return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });

  const cropped = await cropToExactPng(await res.arrayBuffer(), tile.width, tile.height);
  const filename = `${safeName(tile.sizeId)}-${tile.width}x${tile.height}.png`;
  return new Response(new Uint8Array(cropped), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'image/png',
      'Content-Length': String(cropped.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
