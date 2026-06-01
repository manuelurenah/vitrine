import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { BuzzPill } from '@/components/ui';
import { CreativeCard } from './CreativeCard';
import { ExportCampaignButton } from './ExportCampaignButton';
import { SectionHead } from './SectionHead';
import type { Campaign } from '@/lib/campaigns';

type Props = { campaign: Campaign };

export function CampaignDetail({ campaign }: Props) {
  const doneCount = campaign.tiles.filter((t) => t.status === 'done').length;
  return (
    <div className="relative">
      <header className="flex flex-wrap items-start gap-6">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> campaigns
        </Link>
        <div className="flex flex-1 flex-col gap-1">
          <span className="t-eyebrow">// {campaign.brief.goal || 'campaign'} · {campaign.tiles.length} creatives</span>
          <h1 className="t-h2 text-fg-0">{campaign.title}</h1>
          <p className="max-w-[680px] text-[14px] leading-[1.5] text-fg-2">
            {campaign.brief.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BuzzPill amount={campaign.estimatedBuzz} />
          <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
            <Sparkles size={12} strokeWidth={1.75} /> cooking
          </span>
          <ExportCampaignButton campaignId={campaign.id} disabled={doneCount === 0} />
        </div>
      </header>

      <section className="mt-8">
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
              regenerate={{ campaignId: campaign.id, tileId: tile.id }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
