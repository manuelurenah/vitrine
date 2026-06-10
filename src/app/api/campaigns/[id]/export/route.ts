import { type NextRequest, NextResponse } from 'next/server';
import { getCampaign, listCampaignAssets } from '@/lib/campaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { buildZipStored, type ZipEntry } from '@/lib/zip';

type Params = Promise<{ id: string }>;

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
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'campaign';
}

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;

  const campaign = await getCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const entries = await listCampaignAssets(userKey, id);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'no_assets', detail: 'no completed tiles to export' },
      { status: 409 },
    );
  }

  const zipEntries: ZipEntry[] = [];
  const usedNames = new Set<string>();
  let idx = 0;
  for (const entry of entries) {
    let res: Response;
    try {
      res = await fetch(entry.publicUrl);
    } catch (err) {
      return NextResponse.json(
        { error: 'fetch_failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: 'fetch_failed', detail: `${entry.publicUrl} → ${res.status}` },
        { status: 502 },
      );
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const mime = entry.contentType ?? res.headers.get('content-type');
    const ext = extFromMime(mime);
    const base = `${String(idx + 1).padStart(2, '0')}-${safeName(entry.presetId)}`;
    let name = `${base}.${ext}`;
    let dup = 1;
    while (usedNames.has(name)) name = `${base}-${++dup}.${ext}`;
    usedNames.add(name);
    zipEntries.push({ name, data: buf });
    idx += 1;
  }

  const zip = buildZipStored(zipEntries);
  const filename = `${safeName(campaign.title)}.zip`;
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zip.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
