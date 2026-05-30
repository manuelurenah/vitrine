'use client';

import Link from 'next/link';
import { ArrowRight, Link2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { Button, Chip, FieldLabel, Input, Textarea } from '@/components/ui';

const SUGGESTED_COLORS = ['#ff7849', '#ffd13d', '#1c4f29', '#7c5cff', '#19f0ff'] as const;

export function InputStep() {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logoName, setLogoName] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  function toggleColor(c: string) {
    setColors((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  const anyFilled =
    url.trim().length > 0 || description.trim().length > 0 || logoName !== null || colors.length > 0;

  return (
    <section className="flex flex-col gap-10 pt-10">
      <header className="flex flex-col gap-2 text-center">
        <span className="t-eyebrow">// step 1 of 3 · brand dna</span>
        <h2 className="t-h2 text-fg-0">tell us who you are.</h2>
        <p className="mx-auto max-w-[520px] text-[14.5px] leading-[1.5] text-fg-2">
          fill what you have. skip what you don&apos;t. any single field is enough — we&apos;ll figure
          out the rest together.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="your website" tag="optional" />
            <p className="text-[12.5px] text-fg-2">we&apos;ll scrape it for palette, tone, and copy clues.</p>
            <div className="relative">
              <Link2
                size={15}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-fg-2"
              />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="your-shop.co"
                className="pl-[34px]"
                type="url"
              />
            </div>
          </Card>

          <div className="self-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-3">
            or instead
          </div>

          <Card>
            <CardHead title="describe your business" tag="in your own words" />
            <p className="text-[12.5px] text-fg-2">
              like talking to a friend. what do you sell? who buys? what&apos;s the vibe?
            </p>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="we make small-batch chili oil — sold at three farmers markets in austin. customers are mostly food nerds in their 30s…"
            />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="logo" tag="optional" />
            <label
              className="flex h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line bg-bg-3/60 text-fg-2 transition-colors duration-fast ease-out hover:border-line-volt hover:text-volt"
            >
              <UploadCloud size={28} strokeWidth={1.5} />
              <div className="text-center text-[12.5px]">
                <div className="text-fg-1">{logoName ?? 'drop a png, svg, or jpg'}</div>
                <div className="font-mono text-[10.5px] text-fg-3">we crop + tint automatically</div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setLogoName(f.name);
                }}
              />
            </label>
          </Card>

          <Card>
            <CardHead title="brand colors" tag="pick a few" />
            <p className="text-[12.5px] text-fg-2">
              suggestions below or add your own — we extract more from your logo.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_COLORS.map((c) => {
                const on = colors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleColor(c)}
                    aria-pressed={on}
                    className="group relative h-9 w-9 overflow-hidden rounded-pill border transition-all duration-fast ease-out"
                    style={{
                      background: c,
                      borderColor: on ? 'var(--volt)' : 'var(--line)',
                      boxShadow: on ? '0 0 0 3px var(--volt-soft)' : undefined,
                    }}
                  >
                    <span className="sr-only">{c}</span>
                  </button>
                );
              })}
              <Chip>+ add</Chip>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/onboarding/welcome"
          className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg-3 hover:text-fg-1"
        >
          ← back
        </Link>
        <Link href="/onboarding/generating">
          <Button
            variant="primary"
            size="lg"
            disabled={!anyFilled}
            trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}
          >
            cook my dna
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-4">
      {children}
    </div>
  );
}

function CardHead({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-fg-0">
        {title}
      </h3>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{tag}</span>
    </div>
  );
}
