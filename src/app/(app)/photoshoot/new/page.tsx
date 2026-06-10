import { PhotoshootWizard } from '@/components/photoshoot/PhotoshootWizard';
import { getAsset, listAssets } from '@/lib/assets';
import { getProduct, listProducts } from '@/lib/catalog';
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
 * Parse a `?subject=<kind>:<id>` deep-link param. Accepts `asset:<uuid>` and
 * `product:<uuid>`; anything else is ignored. The caller is responsible for
 * validating ownership via `getAsset` / `getProduct` (which are user-scoped).
 */
function parseSubjectParam(
  raw: string | undefined,
): { kind: 'asset' | 'product'; id: string } | null {
  if (!raw) return null;
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) return null;
  const kind = raw.slice(0, colonIdx);
  const id = raw.slice(colonIdx + 1);
  if (!id) return null;
  if (kind === 'asset' || kind === 'product') return { kind, id };
  return null;
}

export default async function NewPhotoshootPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const sp = await searchParams;
  const subjectRaw = firstString(sp.subject);

  let buzz: Awaited<ReturnType<typeof getBuzzAccount>> | null = null;
  let libraryAssets: Awaited<ReturnType<typeof listAssets>> = [];
  let libraryProducts: Awaited<ReturnType<typeof listProducts>> = [];
  let defaultSubject: { kind: 'asset' | 'product'; id: string } | null = null;

  if (session) {
    const userKey = await getUserKey(session);
    [buzz, libraryAssets, libraryProducts] = await Promise.all([
      getBuzzAccount(session).catch(() => null),
      listAssets(userKey),
      listProducts(userKey),
    ]);

    const parsed = parseSubjectParam(subjectRaw);
    if (parsed) {
      if (parsed.kind === 'asset') {
        const a = await getAsset(userKey, parsed.id);
        if (a) defaultSubject = { kind: 'asset', id: parsed.id };
      } else {
        const p = await getProduct(userKey, parsed.id);
        if (p) defaultSubject = { kind: 'product', id: parsed.id };
      }
    }
  }

  return (
    <PhotoshootWizard
      buzzBalance={buzz?.balance ?? null}
      libraryAssets={libraryAssets}
      libraryProducts={libraryProducts}
      defaultSubject={defaultSubject}
    />
  );
}
