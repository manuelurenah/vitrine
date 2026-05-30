'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Camera, Check, Sparkles } from 'lucide-react';
import { Button, Chip, FieldLabel, Input, Textarea, cn } from '@/components/ui';
import {
  PHOTOSHOOT_TEMPLATES,
  type PhotoshootRatio,
  type PhotoshootTemplate,
  type PhotoshootTemplateId,
} from '@/lib/photoshootTemplates';

const RATIOS: PhotoshootRatio[] = ['1:1', '4:5', '9:16', '16:9'];

const GROUP_LABEL: Record<PhotoshootTemplate['group'], string> = {
  studio: 'studio',
  lifestyle: 'lifestyle · in use',
  hero: 'hero',
};

const ALL_TEMPLATES: PhotoshootTemplate[] = Object.values(PHOTOSHOOT_TEMPLATES);

export function PhotoshootBuilder() {
  const router = useRouter();
  const [productName, setProductName] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [ratio, setRatio] = useState<PhotoshootRatio>('4:5');
  const [variants, setVariants] = useState(1);
  const [templateIds, setTemplateIds] = useState<Set<PhotoshootTemplateId>>(
    () => new Set(ALL_TEMPLATES.filter((t) => t.defaultOn).map((t) => t.id)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTemplate(id: PhotoshootTemplateId) {
    setTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalShots = templateIds.size * variants;
  const buzzCost = totalShots * 12;

  const groups = useMemo(() => {
    const out: Record<PhotoshootTemplate['group'], PhotoshootTemplate[]> = {
      studio: [],
      lifestyle: [],
      hero: [],
    };
    for (const t of ALL_TEMPLATES) out[t.group].push(t);
    return out;
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (templateIds.size === 0) {
      setError('pick at least one template');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/photoshoot/cook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim() || 'untitled product',
          productNotes:
            productNotes.trim() ||
            'small-batch product · studio clean · brand-forward, no overlays',
          ratio,
          variantsPerTemplate: variants,
          templateIds: Array.from(templateIds),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      const id = body?.photoshootId as string | undefined;
      if (!id) {
        setError('no photoshoot id returned');
        setSubmitting(false);
        return;
      }
      router.push(`/photoshoot/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative pb-24">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="t-eyebrow">// step 2 · shoot</span>
        <h1 className="mt-[6px] t-h1 text-fg-0">photoshoot.</h1>
        <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] text-fg-2">
          one product → a studio set. pick a couple templates, hit cook, watch them render.
        </p>
      </header>

      <div className="mx-auto mt-10 grid w-full max-w-[1080px] grid-cols-1 gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col gap-4">
          <h2 className="t-eyebrow">// product</h2>
          <div>
            <FieldLabel htmlFor="pn">name</FieldLabel>
            <Input
              id="pn"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="lumen golden serum"
            />
          </div>
          <div>
            <FieldLabel htmlFor="pd">notes</FieldLabel>
            <Textarea
              id="pd"
              value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)}
              rows={5}
              placeholder="15ml amber dropper bottle · turmeric + bakuchiol · warm honey palette"
            />
          </div>
          <p className="text-[12px] text-fg-3">
            we&apos;ll inject these notes into every template prompt. brand dna fills the rest.
          </p>
        </section>

        <section className="flex flex-col gap-6">
          {(['studio', 'lifestyle', 'hero'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h3 className="t-eyebrow">// {GROUP_LABEL[group]}</h3>
                <span className="font-mono text-[10.5px] text-fg-3">
                  {groups[group].length} options
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {groups[group].map((t) => {
                  const on = templateIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTemplate(t.id)}
                      aria-pressed={on}
                      className={cn(
                        'group relative flex flex-col gap-2 rounded-[14px] border bg-bg-2 p-4 text-left transition-all duration-fast ease-out',
                        on
                          ? 'border-line-volt shadow-bloom-volt-sm'
                          : 'border-line-subtle hover:border-line-strong',
                      )}
                    >
                      {on && (
                        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-pill bg-volt text-fg-on-volt">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <span className="font-display text-[15px] font-semibold tracking-[-0.015em] text-fg-0">
                        {t.label}
                      </span>
                      <span className="text-[12.5px] leading-[1.45] text-fg-2">
                        {t.styleNotes.split(',').slice(0, 2).join(',')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-subtle bg-bg-0/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-4 px-9 py-4">
          <div className="flex items-center gap-1">
            {RATIOS.map((r) => (
              <Chip key={r} active={ratio === r} onClick={() => setRatio(r)}>
                {r}
              </Chip>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-3 py-1 font-mono text-[11.5px] text-fg-1">
            variants
            <button
              type="button"
              aria-label="decrement"
              onClick={() => setVariants((v) => Math.max(1, v - 1))}
              className="px-2 text-fg-2 hover:text-fg-0"
            >
              −
            </button>
            <span className="w-4 text-center text-fg-0">{variants}</span>
            <button
              type="button"
              aria-label="increment"
              onClick={() => setVariants((v) => Math.min(4, v + 1))}
              className="px-2 text-fg-2 hover:text-fg-0"
            >
              +
            </button>
          </div>

          <span className="font-mono text-[12px] text-fg-3">
            {totalShots} shot{totalShots === 1 ? '' : 's'} · ~{buzzCost} buzz
          </span>

          {error && (
            <span className="font-mono text-[11.5px] text-danger">{error}</span>
          )}

          <span className="flex-1" />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting || templateIds.size === 0}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            {submitting ? 'cooking…' : 'generate'}
            <span className="ml-1 font-mono text-[12px] opacity-70">· ~{buzzCost} buzz</span>
          </Button>

          <span
            aria-hidden
            className="hidden items-center gap-1 font-mono text-[10.5px] text-fg-3 md:flex"
          >
            <Camera size={12} strokeWidth={1.75} />
            real renders, real buzz
          </span>
        </div>
      </div>
    </form>
  );
}
