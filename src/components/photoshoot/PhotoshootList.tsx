import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui';
import { GradientThumb } from '@/components/campaigns';
import type { Photoshoot } from '@/lib/photoshoots';

const TONES = ['volt', 'ion', 'ultraviolet', 'flux', 'buzz'] as const;

type Props = { shoots: Photoshoot[] };

export function PhotoshootList({ shoots }: Props) {
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
          <span className="t-eyebrow">// step 2 · shoot</span>
          <h1 className="mt-[6px] t-h1 text-fg-0">photoshoot.</h1>
          <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] text-fg-2">
            turn a phone photo into a studio set. pick templates, hit cook, ship.
          </p>
        </header>

        <div className="mx-auto mt-8 flex max-w-[720px] flex-col items-center gap-4">
          <Link href="/photoshoot/new">
            <Button variant="primary" size="lg" leadingIcon={<Camera size={14} strokeWidth={1.75} />}>
              new photoshoot
            </Button>
          </Link>
          <span className="font-mono text-[11px] text-fg-3">
            or jump to assets to edit a single image
          </span>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[14px] font-medium text-fg-0">past shoots</h2>
            <span className="font-mono text-[11.5px] text-fg-3">· {shoots.length}</span>
          </div>

          {shoots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line bg-bg-1 p-10 text-center">
              <div className="font-display text-[18px] font-semibold text-fg-0">
                no shoots yet.
              </div>
              <p className="max-w-[420px] text-[13.5px] text-fg-2">
                spin up your first photoshoot — variants per template, four ratios, real renders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shoots.map((s, i) => {
                const live = s.tiles.filter((t) => t.status === 'done').length;
                const slots = Array.from({ length: 4 });
                return (
                  <Link
                    key={s.id}
                    href={`/photoshoot/${s.id}`}
                    className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong"
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {slots.map((_, slotIdx) => {
                        const url = s.thumbUrls[slotIdx];
                        if (url) {
                          return (
                            <div
                              key={slotIdx}
                              className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-bg-3"
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
                            className="aspect-[4/5]"
                          />
                        );
                      })}
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-fg-0">{s.title}</div>
                      <div className="mt-1 font-mono text-[11px] text-fg-2">
                        {s.brief.ratio} · {s.tiles.length} shots
                        {live > 0 && live < s.tiles.length ? ` · ${s.tiles.length - live} cooking` : ''}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
