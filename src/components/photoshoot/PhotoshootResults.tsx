import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { BuzzPill } from '@/components/ui';
import { CreativeCard } from '@/components/campaigns';
import { SectionHead } from '@/components/campaigns';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';
import type { Photoshoot } from '@/lib/photoshoots';

type Props = { shoot: Photoshoot };

// All photoshoot tiles inherit the same ratio from the brief.
function ratioToPresetId(ratio: string): 'li' | 'ig-feed' | 'ig-story' | 'yt' {
  if (ratio === '1:1') return 'li';
  if (ratio === '4:5') return 'ig-feed';
  if (ratio === '9:16') return 'ig-story';
  return 'yt';
}

export function PhotoshootResults({ shoot }: Props) {
  const tilesByTemplate = new Map<string, typeof shoot.tiles>();
  for (const t of shoot.tiles) {
    const arr = tilesByTemplate.get(t.templateId) ?? [];
    arr.push(t);
    tilesByTemplate.set(t.templateId, arr);
  }

  const presetId = ratioToPresetId(shoot.brief.ratio);

  return (
    <div className="relative">
      <header className="flex flex-wrap items-start gap-6">
        <Link
          href="/photoshoot"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> photoshoot
        </Link>
        <div className="flex flex-1 flex-col gap-1">
          <span className="t-eyebrow">
            // {shoot.brief.ratio} · {shoot.tiles.length} shots
          </span>
          <h1 className="t-h2 text-fg-0">{shoot.title}</h1>
          <p className="max-w-[680px] text-[14px] leading-[1.5] text-fg-2">
            {shoot.brief.productNotes}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BuzzPill amount={shoot.estimatedBuzz} />
          <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
            <Sparkles size={12} strokeWidth={1.75} /> cooking
          </span>
        </div>
      </header>

      {Array.from(tilesByTemplate.entries()).map(([templateId, tiles]) => {
        const tpl = PHOTOSHOOT_TEMPLATES[templateId as keyof typeof PHOTOSHOOT_TEMPLATES];
        return (
          <section key={templateId} className="mt-8">
            <SectionHead
              title={tpl?.label ?? templateId}
              count={`${tiles.length} variant${tiles.length === 1 ? '' : 's'}`}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map((tile) => (
                <CreativeCard
                  key={tile.id}
                  workflowId={tile.workflowId}
                  presetId={presetId}
                  initialStatus={tile.status}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
