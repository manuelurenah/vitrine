import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
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
  const isCooking = shoot.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');

  return (
    <div className="relative">
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-fg-3"
      >
        <Link
          href="/photoshoot"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          photoshoot
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">{shoot.title}</span>
      </nav>

      <header className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="t-eyebrow">
            // {shoot.brief.ratio} · {shoot.tiles.length} shots
          </span>
          <div className="flex items-center gap-3">
            <BuzzPill amount={shoot.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
          </div>
        </div>
        <h1 className="t-h2 text-fg-0">{shoot.title}</h1>
        {shoot.brief.productNotes && (
          <p className="max-w-[680px] text-[14px] leading-[1.5] text-fg-2">
            {shoot.brief.productNotes}
          </p>
        )}
      </header>

      {Array.from(tilesByTemplate.entries()).map(([templateId, tiles]) => {
        const tpl = PHOTOSHOOT_TEMPLATES[templateId as keyof typeof PHOTOSHOOT_TEMPLATES];
        return (
          <section key={templateId} className="mt-10">
            <SectionHead
              title={tpl?.label ?? templateId}
              count={`${tiles.length} variant${tiles.length === 1 ? '' : 's'}`}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tiles.map((tile) => (
                <CreativeCard
                  key={tile.id}
                  workflowId={tile.workflowId}
                  presetId={presetId}
                  initialStatus={tile.status}
                  quantity={tile.quantity}
                  regenerate={{ kind: 'photoshoot', id: shoot.id, tileId: tile.id }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
