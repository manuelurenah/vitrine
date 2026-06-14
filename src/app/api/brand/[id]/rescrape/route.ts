import { type NextRequest, NextResponse } from 'next/server';
import { getBrand } from '@/lib/brand';
import { ScrapeError, scrapeSite } from '@/lib/scrape';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export async function POST(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id } = await ctx.params;

  const brand = await getBrand(userKey, id);
  if (!brand) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!brand.sourceUrl) {
    return NextResponse.json({ error: 'no_source_url' }, { status: 400 });
  }

  let scraped;
  try {
    scraped = await scrapeSite(brand.sourceUrl);
  } catch (err) {
    if (err instanceof ScrapeError) {
      return NextResponse.json({ error: err.code }, { status: 422 });
    }
    return NextResponse.json({ error: 'scrape_failed' }, { status: 500 });
  }

  return NextResponse.json({ scraped });
}
