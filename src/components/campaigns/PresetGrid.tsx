'use client';

import { Check, ImageIcon, Layers, RectangleHorizontal, Video } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui';
import { PRESET_PLATFORMS, type PresetPlatform } from '@/lib/presets';

type PresetGlyph = 'image' | 'video' | 'layers' | 'ad';

type Preset = {
  id: string;
  label: string;
  ratio: string;
  w: number;
  h: number;
  glyph: PresetGlyph;
  defaultOn: boolean;
  platform: PresetPlatform;
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
    platform: 'social',
  },
  {
    id: 'ig-story',
    label: 'ig · story',
    ratio: '9:16',
    w: 22,
    h: 38,
    glyph: 'image',
    defaultOn: true,
    platform: 'social',
  },
  {
    id: 'reels',
    label: 'reels',
    ratio: '9:16',
    w: 22,
    h: 38,
    glyph: 'video',
    defaultOn: false,
    platform: 'social',
  },
  {
    id: 'tiktok',
    label: 'tiktok',
    ratio: '9:16',
    w: 22,
    h: 38,
    glyph: 'video',
    defaultOn: false,
    platform: 'social',
  },
  {
    id: 'fb',
    label: 'facebook',
    ratio: '1.91:1',
    w: 38,
    h: 20,
    glyph: 'layers',
    defaultOn: false,
    platform: 'social',
  },
  {
    id: 'li',
    label: 'linkedin',
    ratio: '1:1',
    w: 34,
    h: 34,
    glyph: 'layers',
    defaultOn: true,
    platform: 'social',
  },
  {
    id: 'x',
    label: 'x / twitter',
    ratio: '16:9',
    w: 38,
    h: 22,
    glyph: 'layers',
    defaultOn: false,
    platform: 'social',
  },
  {
    id: 'yt',
    label: 'youtube',
    ratio: '16:9',
    w: 38,
    h: 22,
    glyph: 'video',
    defaultOn: false,
    platform: 'social',
  },
  {
    id: 'ad-footer-320x50',
    label: 'footer · 320×50',
    ratio: '320:50',
    w: 40,
    h: 8,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
  {
    id: 'ad-leaderboard-728x90',
    label: 'leaderboard · 728×90',
    ratio: '728:90',
    w: 40,
    h: 12,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
  {
    id: 'ad-leaderboard-970x90',
    label: 'leaderboard · 970×90',
    ratio: '970:90',
    w: 42,
    h: 10,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
  {
    id: 'ad-rectangle-300x250',
    label: 'rectangle · 300×250',
    ratio: '300:250',
    w: 34,
    h: 28,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
  {
    id: 'ad-billboard-970x250',
    label: 'billboard · 970×250',
    ratio: '970:250',
    w: 42,
    h: 18,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
  {
    id: 'ad-skyscraper-300x600',
    label: 'skyscraper · 300×600',
    ratio: '300:600',
    w: 19,
    h: 38,
    glyph: 'ad',
    defaultOn: false,
    platform: 'civitai-ads',
  },
];

function Glyph({ kind }: { kind: PresetGlyph }) {
  const props = { size: 14, strokeWidth: 1.75 };
  if (kind === 'image') return <ImageIcon {...props} />;
  if (kind === 'video') return <Video {...props} />;
  if (kind === 'ad') return <RectangleHorizontal {...props} />;
  return <Layers {...props} />;
}

type Props = {
  /** When provided, the grid is controlled and renders exactly these ids. */
  value?: string[];
  onChange?: (ids: string[]) => void;
};

export function PresetGrid({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Set<string>>(
    () => new Set(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)),
  );
  const selected = value !== undefined ? new Set(value) : internal;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (value === undefined) setInternal(next);
    onChange?.(Array.from(next));
  }

  return (
    <div className="flex flex-col gap-6">
      {PRESET_PLATFORMS.map((platform) => {
        const items = PRESETS.filter((p) => p.platform === platform.id);
        if (items.length === 0) return null;
        return (
          <div key={platform.id} className="flex flex-col gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-fg-3">
              {platform.label}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={cn(
                      'group relative flex flex-col items-center gap-3 rounded-[14px] border bg-bg-2 p-4 transition-all duration-fast ease-out motion-safe:hover:-translate-y-[2px]',
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
                      <span
                        className={cn('text-[12.5px] font-medium', on ? 'text-fg-0' : 'text-fg-1')}
                      >
                        {p.label}
                      </span>
                      <span className="font-mono text-[10.5px] text-fg-3">{p.ratio}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
