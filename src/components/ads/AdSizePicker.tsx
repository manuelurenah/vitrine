'use client';

import { Check } from 'lucide-react';
import { AD_SIZE_LIST, type AdSizeDef } from '@/lib/adFormats';
import { cn } from '@/components/ui';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
};

/**
 * Group the flat size list by the ad formats each size belongs to. A size can
 * appear under more than one format (e.g. 728×90 is both a Footer and a Banner),
 * matching how the catalog tags shared sizes.
 */
function groupByFormat(sizes: AdSizeDef[]): Array<{ format: string; sizes: AdSizeDef[] }> {
  const byFormat = new Map<string, AdSizeDef[]>();
  for (const size of sizes) {
    for (const format of size.formats) {
      const bucket = byFormat.get(format) ?? [];
      bucket.push(size);
      byFormat.set(format, bucket);
    }
  }
  return [...byFormat.entries()].map(([format, list]) => ({ format, sizes: list }));
}

const GROUPS = groupByFormat(AD_SIZE_LIST);

/**
 * Controlled multi-select of ad sizes. Each option previews the creative's
 * shape via a CSS aspect-ratio box (capped in size so a thin 728×90 strip and a
 * tall 300×600 skyscraper both stay legible) and mirrors `PresetGrid`'s selected
 * styling.
 */
export function AdSizePicker({ value, onChange }: Props) {
  const selected = new Set(value);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.format} className="flex flex-col gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
            {group.format}
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.sizes.map((size) => {
              const on = selected.has(size.id);
              // Keep the preview box within a sensible footprint regardless of
              // the real pixel size, while preserving the true aspect ratio.
              const wide = size.width >= size.height;
              return (
                <button
                  key={`${group.format}-${size.id}`}
                  type="button"
                  onClick={() => toggle(size.id)}
                  aria-pressed={on}
                  data-size-id={size.id}
                  className={cn(
                    'group relative flex flex-col items-center gap-3 rounded-[14px] border bg-bg-2 p-4 transition-all duration-fast ease-out',
                    on
                      ? 'border-line-volt shadow-bloom-volt-sm'
                      : 'border-line-subtle hover:border-line-strong',
                  )}
                >
                  {on && (
                    <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-pill bg-volt text-fg-on-volt">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <div className="flex h-[68px] w-full items-center justify-center">
                    <div
                      className={cn(
                        'rounded-[4px] border border-line bg-bg-3',
                        on && 'border-line-volt bg-volt-soft',
                      )}
                      style={{
                        aspectRatio: `${size.width} / ${size.height}`,
                        ...(wide ? { width: '76px' } : { height: '60px' }),
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-[2px] text-center">
                    <span
                      className={cn('text-[12.5px] font-medium', on ? 'text-fg-0' : 'text-fg-1')}
                    >
                      {size.label.split(' · ')[0]}
                    </span>
                    <span className="font-mono text-[10.5px] text-fg-3">
                      {size.width}×{size.height}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
