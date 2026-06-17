'use client';

import { Frame, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GradientThumb } from '@/components/campaigns';
import { FAB } from '@/components/shell';
import { useMediaQuery } from '@/components/ui/useMediaQuery';
import type { AdCampaign } from '@/lib/adCampaigns';

const TONES = ['volt', 'ion', 'ultraviolet', 'flux', 'buzz'] as const;

type Props = { campaigns: AdCampaign[] };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

export function AdCampaignsList({ campaigns }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`delete "${title}"? this is not reversible.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' });
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
            'radial-gradient(ellipse 700px 320px at 50% -10%, var(--ultraviolet-soft), transparent 60%)',
        }}
      />

      <div className="relative z-card">
        <header className="mx-auto max-w-[720px] text-center">
          <span className="t-eyebrow">// civitai ads</span>
          <h1 className="mt-[6px] t-h1 text-fg-0">ads.</h1>
          <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] text-fg-2">
            generate ready-to-upload Civitai ad creatives at every placement size. pick sizes, hit
            cook, export.
          </p>
        </header>

        <div className="mt-7 flex justify-center">
          <Link
            href="/ads/new"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-volt bg-volt-soft px-4 font-mono text-[12.5px] uppercase tracking-[0.08em] text-volt shadow-bloom-volt-sm transition-colors duration-fast ease-out hover:bg-volt-soft/80"
          >
            <Plus size={14} strokeWidth={1.75} /> new ad campaign
          </Link>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[14px] font-medium text-fg-0">past ad campaigns</h2>
            <span className="font-mono text-[11.5px] text-fg-3">· {campaigns.length}</span>
          </div>

          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line bg-bg-1 p-10 text-center">
              <GradientThumb
                tone="ultraviolet"
                className="grid h-11 w-11 place-items-center rounded-pill"
              >
                <Frame size={18} strokeWidth={1.75} className="text-ultraviolet" />
              </GradientThumb>
              <div className="font-display text-[18px] font-semibold text-fg-0">no ads yet.</div>
              <p className="max-w-[420px] text-[13.5px] text-fg-2">
                cook your first set of ad creatives —{' '}
                <Link href="/ads/new" className="text-fg-1 underline hover:text-fg-0">
                  start a new ad campaign
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {campaigns.map((c, i) => {
                const live = c.tiles.filter((t) => t.status === 'done').length;
                const cooking = c.tiles.length > 0 && live < c.tiles.length;
                const date = formatDate(c.createdAt);
                return (
                  <Link
                    key={c.id}
                    href={`/ads/${c.id}`}
                    className="group relative flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong"
                  >
                    <button
                      type="button"
                      aria-label="delete ad campaign"
                      disabled={deletingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(c.id, c.title);
                      }}
                      className="absolute right-[14px] top-[14px] z-card flex h-7 w-7 items-center justify-center rounded-[7px] border border-line-subtle bg-black/55 text-white opacity-0 backdrop-blur transition-all duration-fast ease-out hover:border-danger hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50 max-sm:opacity-100"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>

                    <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-bg-3">
                      {c.thumbUrl ? (
                        <img
                          src={c.thumbUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <GradientThumb
                          tone={TONES[i % TONES.length]}
                          className="absolute inset-0 rounded-none"
                        />
                      )}
                      {cooking && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-[5px] rounded-pill border border-line/40 bg-black/55 px-[10px] py-[4px] font-mono text-[10px] uppercase tracking-[0.06em] text-volt backdrop-blur-md">
                          cooking
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-[14px] font-medium text-fg-0">{c.title}</div>
                      <div className="mt-1 font-mono text-[11px] text-fg-2">
                        {c.sizeIds.length} size{c.sizeIds.length === 1 ? '' : 's'} · {date}
                        {cooking ? ` · ${c.tiles.length - live} cooking` : ''}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {isMobile && <FAB href="/ads/new" label="new" aria-label="new ad campaign" />}
    </div>
  );
}
