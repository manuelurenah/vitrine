import { ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { BuzzPill } from '@/components/ui';
import type { AdCampaign } from '@/lib/adCampaigns';
import { AdCreativeCard } from './AdCreativeCard';
import { ExportAdCampaignButton } from './ExportAdCampaignButton';

type Props = { campaign: AdCampaign };

export function AdCampaignDetail({ campaign }: Props) {
  const doneCount = campaign.tiles.filter((t) => t.status === 'done').length;
  const isCooking = campaign.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');
  const tileCount = campaign.tiles.length;

  return (
    <div className="relative">
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <Link
          href="/ads"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          ads
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">{campaign.title}</span>
      </nav>

      <header className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-eyebrow">
            // {campaign.brief.goal || 'ad campaign'} · {tileCount} creative
            {tileCount === 1 ? '' : 's'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <BuzzPill amount={campaign.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
            <ExportAdCampaignButton campaignId={campaign.id} disabled={doneCount === 0} />
          </div>
        </div>
        <h1 className="t-h2 text-fg-0">{campaign.title}</h1>
        {campaign.brief.description && (
          <p className="max-w-[680px] text-[14px] leading-[1.5] text-fg-2">
            {campaign.brief.description}
          </p>
        )}
      </header>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[14px] font-medium text-fg-0">creatives</h2>
          <span className="font-mono text-[11.5px] text-fg-3">· {tileCount}</span>
          {isCooking && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
              live polling
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {campaign.tiles.map((tile) => (
            <AdCreativeCard key={tile.id} campaignId={campaign.id} tile={tile} />
          ))}
        </div>
      </section>
    </div>
  );
}
