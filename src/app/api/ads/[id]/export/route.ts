import { type NextRequest, NextResponse } from 'next/server';
import { getAdCampaign, listAdCampaignAssets } from '@/lib/adCampaigns';
import { cropToExactPng } from '@/lib/adExport';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { buildZipStored, type ZipEntry } from '@/lib/zip';

type Params = Promise<{ id: string }>;

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'ad-campaign';
}

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const entries = await listAdCampaignAssets(userKey, id);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'no_assets', detail: 'no completed creatives' },
      { status: 409 },
    );
  }

  const zipEntries: ZipEntry[] = [];
  const used = new Set<string>();
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
      return NextResponse.json({ error: 'fetch_failed', detail: `${res.status}` }, { status: 502 });
    }
    const cropped = await cropToExactPng(await res.arrayBuffer(), entry.width, entry.height);
    let name = `${safeName(entry.sizeId)}-${entry.width}x${entry.height}.png`;
    let dup = 1;
    while (used.has(name))
      name = `${safeName(entry.sizeId)}-${entry.width}x${entry.height}-${++dup}.png`;
    used.add(name);
    zipEntries.push({ name, data: cropped });
  }

  const zip = buildZipStored(zipEntries);
  const filename = `${safeName(campaign.title)}-ads.zip`;
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zip.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
