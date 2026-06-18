import { type NextRequest, NextResponse } from 'next/server';
import { cropToExactPng } from '@/lib/adExport';
import { getCampaign } from '@/lib/campaigns';
import { PRESETS } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
};

function extFromMime(mime: string | null): string {
  if (!mime) return 'bin';
  return EXT_BY_MIME[mime] ?? mime.split('/')[1] ?? 'bin';
}

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'creative';
}

/**
 * Single-creative download. Ad-format tiles are center-cropped to the preset's
 * EXACT width×height and delivered as PNG; social tiles return their raw bytes
 * untouched. Auth/ownership scoped via {@link getCampaign}.
 */
export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const campaign = await getCampaign(userKey, id);
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
    console.error('tile download fetch failed', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
  if (!res.ok) {
    console.error('tile download upstream non-ok', tile.assetUrl, res.status);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  const preset = PRESETS[tile.presetId];

  if (preset?.exact === true) {
    const cropped = await cropToExactPng(buf, preset.width, preset.height);
    const filename = `${safeName(tile.presetId)}-${preset.width}x${preset.height}.png`;
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

  // Social tile: return the raw bytes exactly as stored.
  const mime = res.headers.get('content-type');
  const ext = extFromMime(mime);
  const filename = `${safeName(tile.presetId)}.${ext}`;
  return new Response(buf, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': mime ?? 'application/octet-stream',
      'Content-Length': String(buf.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
