import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CreativeEditor } from '@/components/campaigns/CreativeEditor';
import { getCampaign } from '@/lib/campaigns';
import { getDefaultBrand } from '@/lib/brand';
import { getSession } from '@/lib/session';
import { listTileVersions } from '@/lib/tileVersions';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string; creativeId: string }>;
type SearchParams = Promise<{ v?: string }>;

export default async function CreativeEditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  const { id, creativeId } = await params;
  const { v } = await searchParams;
  // `?v=<n>` selects which variant (image index) the editor opens on. Clamp to
  // a non-negative integer; the editor falls back to the first image if the
  // index is out of range.
  const parsedVariant = Number.parseInt(v ?? '', 10);
  const initialVariant = Number.isFinite(parsedVariant) && parsedVariant > 0 ? parsedVariant : 0;

  const [campaign, brand] = await Promise.all([getCampaign(userKey, id), getDefaultBrand(userKey)]);
  if (!campaign) notFound();

  const tile = campaign.tiles.find((t) => t.id === creativeId);
  if (!tile) notFound();

  const versions = await listTileVersions(userKey, id, creativeId);

  return (
    <div>
      {/* breadcrumb */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <Link
          href="/campaigns"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          campaigns
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <Link
          href={`/campaigns/${id}`}
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          {campaign.title}
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">
          {tile.adCopy?.headline ?? `creative · ${tile.presetId}`}
        </span>
      </nav>

      <header className="mt-4 mb-8">
        <span className="t-eyebrow">// creative editor · {tile.presetId}</span>
        <h1 className="t-h2 mt-1 text-fg-0">{tile.adCopy?.headline ?? campaign.title}</h1>
      </header>

      <CreativeEditor
        campaignId={id}
        campaignTitle={campaign.title}
        brandName={brand?.name ?? null}
        brandPalette={brand?.palette ?? []}
        brandLogoUrl={brand?.logoUrl ?? null}
        tile={tile}
        versions={versions}
        initialVariant={initialVariant}
      />
    </div>
  );
}
