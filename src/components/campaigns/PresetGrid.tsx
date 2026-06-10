'use client';

import { Check, ImageIcon, Layers, Video } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui';

type PresetGlyph = 'image' | 'video' | 'layers';

type Preset = {
  id: string;
  label: string;
  ratio: string;
  w: number;
  h: number;
  glyph: PresetGlyph;
  defaultOn: boolean;
};

const PRESETS: Preset[] = [
  {
    id: 'ig-feed',
    label: 'ig · feed',
    ratio: '4:5',
    w: 30,
    h: 38,
    glyph: 'image',
    defaultOn: true,
  },
  {
    id: 'ig-story',
    label: 'ig · story',
    ratio: '9:16',
    w: 22,
    h: 38,
    glyph: 'image',
    defaultOn: true,
  },
  { id: 'reels', label: 'reels', ratio: '9:16', w: 22, h: 38, glyph: 'video', defaultOn: false },
  { id: 'tiktok', label: 'tiktok', ratio: '9:16', w: 22, h: 38, glyph: 'video', defaultOn: false },
  { id: 'fb', label: 'facebook', ratio: '1.91:1', w: 38, h: 20, glyph: 'layers', defaultOn: false },
  { id: 'li', label: 'linkedin', ratio: '1:1', w: 34, h: 34, glyph: 'layers', defaultOn: true },
  { id: 'x', label: 'x / twitter', ratio: '16:9', w: 38, h: 22, glyph: 'layers', defaultOn: false },
  { id: 'yt', label: 'youtube', ratio: '16:9', w: 38, h: 22, glyph: 'video', defaultOn: false },
];

function Glyph({ kind }: { kind: PresetGlyph }) {
  const props = { size: 14, strokeWidth: 1.75 };
  if (kind === 'image') return <ImageIcon {...props} />;
  if (kind === 'video') return <Video {...props} />;
  return <Layers {...props} />;
}

type Props = { onChange?: (ids: string[]) => void };

export function PresetGrid({ onChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange?.(Array.from(next));
      return next;
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {PRESETS.map((p) => {
        const on = selected.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            aria-pressed={on}
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
            <div
              className={cn(
                'relative flex items-center justify-center rounded-[6px] border border-line bg-bg-3 text-fg-2',
                on && 'border-line-volt text-volt',
              )}
              style={{ width: p.w * 2, height: p.h * 2 }}
            >
              <Glyph kind={p.glyph} />
            </div>
            <div className="flex flex-col items-center gap-[2px]">
              <span className={cn('text-[12.5px] font-medium', on ? 'text-fg-0' : 'text-fg-1')}>
                {p.label}
              </span>
              <span className="font-mono text-[10.5px] text-fg-3">{p.ratio}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
