import { PhotoshootWizard } from '@/components/photoshoot/PhotoshootWizard';
import { listAssets } from '@/lib/assets';
import { listProducts } from '@/lib/catalog';
import { getBuzzAccount } from '@/lib/civitai';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'new photoshoot · vitrine' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Parse a comma-separated `?refs=` param into prefixed reference ids. Mirrors
 * the campaign page: keep only `product:`/`asset:` prefixed ids and cap at 4.
 */
function parseRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('product:') || id.startsWith('asset:'))
    .slice(0, 4);
}

/**
 * Parse a legacy `?subject=<kind>:<id>` deep-link param. Accepts `asset:<id>`
 * and `product:<id>`; anything else returns null. We fold a valid subject into
 * the refs list so deep-linked products/assets become a pre-selected reference.
 */
function parseSubjectRef(raw: string | undefined): string | null {
  if (!raw) return null;
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) return null;
  const kind = raw.slice(0, colonIdx);
  const id = raw.slice(colonIdx + 1);
  if (!id) return null;
  if (kind === 'asset' || kind === 'product') return `${kind}:${id}`;
  return null;
}

export default async function NewPhotoshootPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const sp = await searchParams;
  const promptParam = firstString(sp.prompt)?.trim() || null;

  // Compose the reference list from `?refs` plus a legacy `?subject`, deduped.
  const refs = parseRefs(firstString(sp.refs));
  const subjectRef = parseSubjectRef(firstString(sp.subject));
  const referenceAssetIds = subjectRef
    ? Array.from(new Set([subjectRef, ...refs])).slice(0, 4)
    : refs;

  let buzz: Awaited<ReturnType<typeof getBuzzAccount>> | null = null;
  let libraryAssets: Awaited<ReturnType<typeof listAssets>> = [];
  let libraryProducts: Awaited<ReturnType<typeof listProducts>> = [];

  if (session) {
    const userKey = await getUserKey(session);
    [buzz, libraryAssets, libraryProducts] = await Promise.all([
      getBuzzAccount(session).catch(() => null),
      listAssets(userKey),
      listProducts(userKey),
    ]);
  }

  return (
    <PhotoshootWizard
      prompt={promptParam}
      referenceAssetIds={referenceAssetIds}
      buzzBalance={buzz?.balance ?? null}
      libraryAssets={libraryAssets}
      libraryProducts={libraryProducts}
    />
  );
}
