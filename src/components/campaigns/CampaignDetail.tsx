import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { BuzzPill } from '@/components/ui';
import { CreativeCard } from './CreativeCard';
import { ExportCampaignButton } from './ExportCampaignButton';
import { SectionHead } from './SectionHead';
import type { Campaign } from '@/lib/campaigns';

type Props = { campaign: Campaign };

export function CampaignDetail({ campaign }: Props) {
  const doneCount = campaign.tiles.filter((t) => t.status === 'done').length;
  const isCooking = campaign.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');
  return (
    <div className="relative">
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-fg-3"
      >
        <Link
          href="/campaigns"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          campaigns
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">{campaign.title}</span>
      </nav>

      <header className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="t-eyebrow">
            // {campaign.brief.goal || 'campaign'} · {campaign.tiles.length} creatives
          </span>
          <div className="flex items-center gap-3">
            <BuzzPill amount={campaign.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
            <ExportCampaignButton campaignId={campaign.id} disabled={doneCount === 0} />
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
        <SectionHead
          title="creatives"
          count={`${campaign.tiles.length}`}
          action={<span className="font-mono text-[10.5px] uppercase tracking-[0.1em]">live polling</span>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {campaign.tiles.map((tile) => (
            <CreativeCard
              key={tile.id}
              workflowId={tile.workflowId}
              presetId={tile.presetId}
              initialStatus={tile.status}
              quantity={tile.quantity}
              regenerate={{ kind: 'campaign', id: campaign.id, tileId: tile.id }}
              adCopy={tile.adCopy}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
