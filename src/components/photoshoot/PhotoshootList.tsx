'use client';

import { Camera, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GradientThumb } from '@/components/campaigns';
import { FAB } from '@/components/shell';
import { Button } from '@/components/ui';
import { useMediaQuery } from '@/components/ui/useMediaQuery';
import type { Photoshoot } from '@/lib/photoshoots';

const TONES = ['volt', 'ion', 'ultraviolet', 'flux', 'buzz'] as const;

type Props = { shoots: Photoshoot[] };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

export function PhotoshootList({ shoots }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`delete "${title}"? this is not reversible.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/photoshoot/${id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-7 z-base h-[420px] opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 700px 320px at 50% -10%, var(--ion-soft), transparent 60%)',
        }}
      />

      <div className="relative z-card">
        <header className="mx-auto max-w-[720px] text-center">
          <span className="t-eyebrow">// step 1 · shoot</span>
          <h1 className="mt-[6px] t-h1 text-fg-0">photoshoot.</h1>
          <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] text-fg-2">
            turn a phone photo into a studio set. pick templates, hit cook, ship.
          </p>
        </header>

        {/* hero CTA card */}
        <div className="relative mx-auto mt-8 max-w-[720px] overflow-hidden rounded-[18px] border border-line bg-bg-2 p-[18px]">
          {/* gradient backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 90% 50%, rgba(0,255,157,0.10), transparent 60%)',
            }}
          />

          <div className="relative flex flex-wrap items-center gap-4">
            {/* icon bloom */}
            <div
              aria-hidden
              className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-[14px] border border-line-volt bg-volt-soft text-volt shadow-bloom-volt-sm"
            >
              <Camera size={22} strokeWidth={1.75} />
            </div>

            {/* copy */}
            <div className="min-w-0 flex-1">
              <div className="font-display text-[19px] font-bold leading-[1.2] tracking-tight text-fg-0">
                new photoshoot
              </div>
              <div className="mt-1 text-[13.5px] leading-[1.45] text-fg-2">
                pick a product · choose up to 4 templates · we cook a full set of on-brand variants.
              </div>
            </div>

            {/* CTA — hidden on mobile (FAB handles new shoot) */}
            <Link
              href="/photoshoot/new"
              aria-label="start a new photoshoot"
              className="hidden sm:block"
            >
              <Button
                variant="primary"
                leadingIcon={<Plus size={14} strokeWidth={2} aria-hidden />}
              >
                start
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2 font-mono text-[12.5px] text-fg-3">
          <span>just want to edit or generate a single image?</span>
          <Link href="/assets" className="text-fg-1 hover:text-fg-0">
            → assets · generate or edit
          </Link>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[14px] font-medium text-fg-0">past photoshoots</h2>
            <span className="font-mono text-[11.5px] text-fg-3">· {shoots.length}</span>
          </div>

          {shoots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line bg-bg-1 p-10 text-center">
              <div className="font-display text-[18px] font-semibold text-fg-0">no shoots yet.</div>
              <p className="max-w-[420px] text-[13.5px] text-fg-2">
                spin up your first photoshoot — variants per template, four ratios, real renders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shoots.map((s, i) => {
                const live = s.tiles.filter((t) => t.status === 'done').length;
                const slots = Array.from({ length: 4 });
                const date = formatDate(s.createdAt);
                return (
                  <Link
                    key={s.id}
                    href={`/photoshoot/${s.id}`}
                    className="group relative flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong"
                  >
                    <button
                      type="button"
                      aria-label="delete photoshoot"
                      disabled={deletingId === s.id}
                      onClick={(e) => {
                        // Card is a Link — keep the click from navigating.
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(s.id, s.title);
                      }}
                      className="absolute right-[14px] top-[14px] z-card flex h-7 w-7 items-center justify-center rounded-[7px] border border-line-subtle bg-bg-0/70 text-fg-2 opacity-0 backdrop-blur transition-all duration-fast ease-out hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50 max-sm:opacity-100"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>

                    {/* 2×2 square collage */}
                    <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-[10px]">
                      {slots.map((_, slotIdx) => {
                        const url = s.thumbUrls[slotIdx];
                        if (url) {
                          return (
                            <div
                              key={slotIdx}
                              className="relative aspect-square overflow-hidden bg-bg-3"
                            >
                              <img
                                src={url}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                          );
                        }
                        return (
                          <GradientThumb
                            key={slotIdx}
                            tone={TONES[(i + slotIdx) % TONES.length]}
                            className="aspect-square rounded-none"
                          />
                        );
                      })}
                    </div>

                    <div>
                      <div className="text-[14px] font-medium text-fg-0">{s.title}</div>
                      <div className="mt-1 font-mono text-[11px] text-fg-2">
                        {s.brief.ratio} · {s.tiles.length} shots · {date}
                        {live > 0 && live < s.tiles.length
                          ? ` · ${s.tiles.length - live} cooking`
                          : ''}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Mobile FAB — new photoshoot */}
      {isMobile && <FAB href="/photoshoot/new" label="new" aria-label="new photoshoot" />}
    </div>
  );
}
