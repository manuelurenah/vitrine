import { ChevronRight, History } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { VersionHistory } from '@/components/campaigns/VersionHistory';
import { getDefaultBrand } from '@/lib/brand';
import { getCampaign } from '@/lib/campaigns';
import { getSession } from '@/lib/session';
import { listTileVersions } from '@/lib/tileVersions';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string; creativeId: string }>;

export default async function CreativeHistoryPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  const { id, creativeId } = await params;

  const [campaign, brand] = await Promise.all([getCampaign(userKey, id), getDefaultBrand(userKey)]);
  if (!campaign) notFound();

  const tile = campaign.tiles.find((t) => t.id === creativeId);
  if (!tile) notFound();

  const versions = await listTileVersions(userKey, id, creativeId);

  const creativeLabel = tile.adCopy?.headline ?? `creative · ${tile.presetId}`;

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
        <Link
          href={`/campaigns/${id}/c/${creativeId}`}
          className="truncate rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          {creativeLabel}
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="px-1.5 py-0.5 text-fg-1">history</span>
      </nav>

      <header className="mt-4 mb-8">
        <span className="t-eyebrow">// version history · {tile.presetId}</span>
        <h1 className="t-h2 mt-1 text-fg-0">{creativeLabel}</h1>
      </header>

      {versions.length === 0 ? (
        <div className="grid place-items-center rounded-[14px] border border-dashed border-line-subtle bg-bg-2 px-6 py-16 text-center">
          <div className="grid size-11 place-items-center rounded-pill border border-line-subtle bg-bg-3 text-fg-3">
            <History size={18} strokeWidth={1.75} />
          </div>
          <p className="mt-4 font-display text-[15px] font-semibold text-fg-0">no versions yet</p>
          <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-[1.5] text-fg-2">
            edits and regenerations are tracked here. make a change to this creative to start its
            history.
          </p>
          <Link
            href={`/campaigns/${id}/c/${creativeId}`}
            className="mt-5 rounded-pill border border-line-subtle bg-bg-2 px-3.5 py-1.5 text-[12.5px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
          >
            back to editor
          </Link>
        </div>
      ) : (
        <VersionHistory
          campaignId={id}
          creativeId={creativeId}
          presetId={tile.presetId}
          brandName={brand?.name ?? null}
          versions={versions}
        />
      )}
    </div>
  );
}
