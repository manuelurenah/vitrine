import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { patchOnboardingPayload, type ScrapedSite } from '@/lib/onboarding';
import { ScrapeError, scrapeSite } from '@/lib/scrape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  url: z.string().min(3).max(2048),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await scrapeSite(parsed.data.url);
  } catch (err) {
    if (err instanceof ScrapeError) {
      const status =
        err.code === 'invalid_url' || err.code === 'blocked_host'
          ? 400
          : err.code === 'timeout'
            ? 504
            : 502;
      return NextResponse.json({ error: err.code, detail: err.message }, { status });
    }
    return NextResponse.json(
      { error: 'scrape_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const scrape: ScrapedSite = {
    fetchedAt: Date.now(),
    finalUrl: result.finalUrl,
    brandName: result.brandName,
    description: result.description,
    logoUrl: result.logoUrl,
    themeColor: result.themeColor,
    palette: result.palette,
    font: result.font,
  };

  const userKey = await getUserKey(session);
  // Persist the scrape *and* its derived fields (description + top-4 colors
  // + font) in the same write. The client also applies these locally, but
  // server persistence here closes the race where a user navigates away
  // before the debounced client patch can fire.
  await patchOnboardingPayload(userKey, {
    websiteUrl: parsed.data.url,
    scrape,
    brandName: scrape.brandName ?? undefined,
    description: scrape.description ?? undefined,
    colors: scrape.palette.slice(0, 4),
    font: scrape.font ?? undefined,
  });

  return NextResponse.json({ scrape });
}
