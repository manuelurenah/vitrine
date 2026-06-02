import { CampaignWizard } from '@/components/campaigns/CampaignWizard';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getDefaultBrand } from '@/lib/brand';
import { listProducts } from '@/lib/catalog';
import { listAssets } from '@/lib/assets';

export const metadata = { title: 'new campaign · vitrine' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('product:') || id.startsWith('asset:'))
    .slice(0, 4);
}

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const promptParam = firstString(sp.prompt)?.trim();
  const refsParam = parseRefs(firstString(sp.refs));
  const defaultBrief = promptParam
    ? { prompt: promptParam, description: promptParam }
    : undefined;

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-8">
        <CampaignWizard
          initial={
            defaultBrief || refsParam.length > 0
              ? {
                  ...(defaultBrief ? { defaultBrief } : {}),
                  ...(refsParam.length > 0
                    ? { defaultReferenceAssetIds: refsParam }
                    : {}),
                }
              : undefined
          }
        />
      </main>
    );
  }

  const userKey = await getUserKey(session);
  const [brand, products, assets] = await Promise.all([
    getDefaultBrand(userKey),
    listProducts(userKey),
    listAssets(userKey),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <span className="t-eyebrow">// new campaign</span>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg-0">
          cook a campaign
        </h1>
        <p className="text-[13.5px] text-fg-2">
          brief → review → submit. {products.length} product
          {products.length === 1 ? '' : 's'} · {assets.length} asset
          {assets.length === 1 ? '' : 's'} available as references.
        </p>
      </header>
      <CampaignWizard
        initial={{
          brandName: brand?.name ?? null,
          productCount: products.length,
          assetCount: assets.length,
          ...(defaultBrief ? { defaultBrief } : {}),
          ...(refsParam.length > 0 ? { defaultReferenceAssetIds: refsParam } : {}),
        }}
      />
    </main>
  );
}
