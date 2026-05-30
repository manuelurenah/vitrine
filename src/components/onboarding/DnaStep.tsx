'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Chip, cn } from '@/components/ui';

const PALETTE = ['#ff7849', '#ffd13d', '#1c4f29', '#7c5cff'] as const;

type Tab = 'overview' | 'details';

export function DnaStep() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <section className="flex flex-col gap-8 pt-10">
      <header className="flex flex-col gap-2 text-center">
        <span className="t-eyebrow">// your brand dna</span>
        <h2 className="t-h2 text-fg-0">your brand dna.</h2>
        <p className="mx-auto max-w-[520px] text-[14.5px] text-fg-2">
          we read everything you gave us. edit anything that feels off — vitrine will learn.
        </p>
      </header>

      <div className="mx-auto flex items-center gap-1 rounded-pill border border-line-subtle bg-bg-2 p-1">
        {(['overview', 'details'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-pill px-4 py-[6px] font-mono text-[11.5px] uppercase tracking-[0.1em] transition-colors duration-fast ease-out',
              tab === t ? 'bg-bg-0 text-fg-0' : 'text-fg-2 hover:text-fg-0',
            )}
          >
            {t === 'overview' ? 'brand overview' : 'business details'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <Overview /> : <Details />}

      <div className="flex items-center justify-between border-t border-line-subtle pt-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            dna readiness
          </span>
          <span className="h-2 w-[160px] overflow-hidden rounded-pill bg-bg-3">
            <span className="block h-full w-full bg-volt" />
          </span>
          <span className="font-mono text-[11px] text-volt">100%</span>
        </div>
        <Link href="/onboarding/next">
          <Button variant="primary" size="lg" trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}>
            let&apos;s go
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Overview() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <DnaCard title="identity">
        <div className="font-display text-[34px] font-bold tracking-[-0.03em] text-fg-0">
          lumen<span className="text-volt">.</span>
        </div>
        <p className="text-[13px] text-fg-2">lumen skincare · lumen.co</p>
      </DnaCard>

      <DnaCard title="palette">
        <div className="flex gap-2">
          {PALETTE.map((c) => (
            <div
              key={c}
              className="flex h-[56px] w-[56px] flex-col items-end justify-end rounded-[10px] border border-line p-2"
              style={{ background: c }}
            >
              <span className="font-mono text-[9.5px] uppercase text-white/80">{c.slice(1)}</span>
            </div>
          ))}
        </div>
      </DnaCard>

      <DnaCard title="fonts">
        <div className="flex flex-col gap-3">
          <div className="font-display text-[36px] leading-none">Aa</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-2">
            bricolage grotesque · display
          </div>
        </div>
      </DnaCard>

      <DnaCard title="audience">
        <div className="flex flex-wrap gap-2">
          <Chip active>millennials · 28-38</Chip>
          <Chip active>food nerds</Chip>
          <Chip>gift buyers</Chip>
        </div>
      </DnaCard>
    </div>
  );
}

function Details() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <DnaCard title="tagline">
        <p className="font-display text-[22px] leading-[1.2] tracking-[-0.02em] text-fg-0">
          small-batch heat. honest oil.
        </p>
      </DnaCard>
      <DnaCard title="aesthetic">
        <div className="flex flex-wrap gap-2">
          <Chip active>warm</Chip>
          <Chip active>natural light</Chip>
          <Chip active>market-real</Chip>
          <Chip>festive</Chip>
        </div>
      </DnaCard>
      <DnaCard title="tone of voice">
        <div className="flex flex-wrap gap-2">
          <Chip active>playful</Chip>
          <Chip active>plainspoken</Chip>
          <Chip active>lowercase</Chip>
          <Chip>punchy</Chip>
        </div>
      </DnaCard>
      <DnaCard title="business overview">
        <p className="text-[13.5px] leading-[1.5] text-fg-1">
          chili oil makers based in austin. four core sku&apos;s, two seasonal. sells at three farmers
          markets, three coffee shops, and online. target buyer is a food-curious millennial who
          gifts well.
        </p>
      </DnaCard>
    </div>
  );
}

function DnaCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-4">
      <span className="t-eyebrow">// {title}</span>
      {children}
    </article>
  );
}
