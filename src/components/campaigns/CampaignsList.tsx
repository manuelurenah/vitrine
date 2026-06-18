'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BadgeKind } from '@/components/ui';
import { relativeDate } from '@/lib/relativeDate';
import { GradientThumb, type ThumbTone } from './GradientThumb';
import { PastRow } from './PastRow';
import { PromptComposer } from './PromptComposer';
import { SectionHead } from './SectionHead';

export { relativeDate };

type PastCampaign = {
  id: string;
  name: string;
  date: string;
  count: string;
  status: BadgeKind | null;
  tone: ThumbTone;
  thumbUrl?: string | null;
};

type Props = {
  past?: PastCampaign[];
};

export function CampaignsList({ past }: Props) {
  const pastItems: PastCampaign[] = past ?? [];
  const hasPast = pastItems.length > 0;
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`delete "${name}"? this is not reversible.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-7 z-base h-[480px] opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 720px 360px at 50% -20%, var(--volt-soft), transparent 60%)',
        }}
      />

      <div className="relative z-card">
        <div className="mx-auto max-w-[720px] text-center">
          <span className="t-eyebrow">// step 1 · brief</span>
          <h1 className="mt-[6px] t-h1 text-fg-0">campaigns.</h1>
          <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] leading-[1.5] text-fg-2">
            describe the campaign you want — we&apos;ll cook the brief, then the assets.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-[720px]">
          <PromptComposer />
          <p className="mt-2 text-center text-[12px] text-fg-3">
            we can be wrong — review every brief before generating.
          </p>
        </div>

        {hasPast ? (
          <section className="mt-9">
            <SectionHead title="past campaigns" count={String(pastItems.length)} />
            <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-bg-2">
              {pastItems.map((p, i) => (
                <Link key={p.id || p.name} href={p.id ? `/campaigns/${p.id}` : '#'}>
                  <PastRow
                    {...p}
                    last={i === pastItems.length - 1}
                    busy={deletingId === p.id}
                    onDelete={p.id ? () => handleDelete(p.id, p.name) : undefined}
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-9 flex flex-col items-center gap-[10px] rounded-[18px] border border-dashed border-line bg-bg-1 p-8 text-center">
            <GradientThumb tone="volt" className="grid h-11 w-11 place-items-center rounded-pill">
              <span className="font-display text-xl text-volt">+</span>
            </GradientThumb>
            <div className="font-display text-[18px] font-semibold tracking-[-0.015em] text-fg-0">
              no campaigns yet.
            </div>
            <div className="max-w-[400px] text-[13.5px] text-fg-2">
              type a prompt above to cook your first campaign.
            </div>
          </section>
        )}
      </div>

    </div>
  );
}
