import { AddProductForm } from '@/components/catalog';
import { listAssets } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'new product · vitrine' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseImageRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('asset:'))
    .map((id) => id.slice('asset:'.length))
    .filter(Boolean)
    .slice(0, 8);
}

export default async function NewProductPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const sp = await searchParams;
  const prefillIds = parseImageRefs(firstString(sp.images));

  let assets: Awaited<ReturnType<typeof listAssets>> = [];
  if (session) {
    const userKey = await getUserKey(session);
    assets = await listAssets(userKey);
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">brand DNA · new</span>
        <h1 className="t-h2 text-fg-0">add a product.</h1>
        <p className="text-[13.5px] text-fg-2">drop product photos — first one is the hero.</p>
      </header>

      <AddProductForm libraryAssets={assets} prefillAssetIds={prefillIds} />
    </div>
  );
}
