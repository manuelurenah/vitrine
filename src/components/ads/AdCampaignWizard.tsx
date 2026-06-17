'use client';

import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import {
  Button,
  BuzzPill,
  cn,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { recommendedAdSizeIds } from '@/lib/adFormats';
import { buzzTopUpUrl } from '@/lib/links';
import { AdSizePicker } from './AdSizePicker';

export type AdCampaignWizardInitial = {
  brandName?: string | null;
  productCount?: number;
  assetCount?: number;
  buzzBalance?: number | null;
  defaultReferenceAssetIds?: string[];
};

type Props = {
  initial?: AdCampaignWizardInitial;
  /** Test seam — defaults to window.fetch. */
  fetcher?: typeof fetch;
};

type Step = 'brief' | 'review' | 'submit';

type AdCopyShape = { headline: string; subhead: string; cta: string };

type BriefShape = {
  title: string;
  description: string;
  goal: string;
  offer: string;
  audience: string;
  aesthetics: string;
};

const DEFAULT_BRIEF: BriefShape = {
  title: '',
  description: '',
  goal: '',
  offer: '',
  audience: '',
  aesthetics: '',
};

const GOAL_OPTIONS = [
  'promote a new product',
  'drive signups',
  'announce a launch',
  'seasonal sale',
  'build awareness',
] as const;

type EstimateResponse = { total: number; perSize: Record<string, number> };

/**
 * New-ad-campaign flow: a single brief step (fields, sizes, optional ad copy)
 * followed by a review step that surfaces the per-cook Buzz estimate before
 * submitting to `/api/ads/cook`. No LLM draft pass — the brief is authored
 * directly, then one creative is generated per selected ad size.
 */
export function AdCampaignWizard({ initial, fetcher }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('brief');

  const [brief, setBrief] = useState<BriefShape>(DEFAULT_BRIEF);
  const [sizeIds, setSizeIds] = useState<string[]>(() => recommendedAdSizeIds());
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>(
    () => initial?.defaultReferenceAssetIds ?? [],
  );
  const [withCopy, setWithCopy] = useState(false);
  const [copy, setCopy] = useState<AdCopyShape>({ headline: '', subhead: '', cta: '' });

  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [partial, setPartial] = useState<Array<{ sizeId: string; error: string }> | null>(null);

  const buzzBalance = initial?.buzzBalance ?? null;

  function update<K extends keyof BriefShape>(key: K, value: BriefShape[K]) {
    setBrief((prev) => ({ ...prev, [key]: value }));
  }

  // The cook/estimate routes require non-empty `prompt`, `title`, `description`.
  // The wizard has no separate prompt field, so the description doubles as the
  // prompt source — composed with the title so it's always populated.
  const buildPayload = useCallback(() => {
    const description = brief.description.trim();
    const title = brief.title.trim();
    const prompt = [title, description].filter(Boolean).join(' — ') || description || title;
    const adCopy =
      withCopy && copy.headline.trim() && copy.subhead.trim()
        ? {
            headline: copy.headline.trim(),
            subhead: copy.subhead.trim(),
            ...(copy.cta.trim() ? { cta: copy.cta.trim() } : {}),
          }
        : null;
    return {
      title,
      description,
      prompt,
      goal: brief.goal.trim(),
      offer: brief.offer.trim(),
      audience: brief.audience.trim(),
      aesthetics: brief.aesthetics.trim(),
      sizeIds,
      referenceAssetIds,
      ...(adCopy ? { adCopy } : {}),
    };
  }, [brief, copy, withCopy, sizeIds, referenceAssetIds]);

  const canContinue =
    brief.title.trim().length > 0 && brief.description.trim().length > 0 && sizeIds.length > 0;

  /* ----------------------------------------------------- estimate on review */
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (step !== 'review') return;
    if (!canContinue) return;
    const reqId = ++reqIdRef.current;
    setEstimating(true);
    setEstimateError(null);
    const payload = buildPayload();
    const f = fetcher ?? fetch;
    void (async () => {
      try {
        const res = await f('/api/ads/estimate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (reqId !== reqIdRef.current) return;
        if (!res.ok) {
          setEstimate(null);
          setEstimateError('estimate unavailable');
          return;
        }
        const json = (await res.json()) as EstimateResponse;
        if (reqId !== reqIdRef.current) return;
        setEstimate(json);
      } catch {
        if (reqId !== reqIdRef.current) return;
        setEstimate(null);
        setEstimateError('estimate unavailable');
      } finally {
        if (reqId === reqIdRef.current) setEstimating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* --------------------------------------------------------------- cooking */
  async function doCook() {
    setSubmitting(true);
    setSubmitError(null);
    setPartial(null);
    try {
      const f = fetcher ?? fetch;
      const res = await f('/api/ads/cook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json().catch(() => ({}))) as {
        adCampaignId?: string;
        partial?: Array<{ sizeId: string; error: string }>;
        error?: string;
      };
      if (!res.ok || !json.adCampaignId) {
        setSubmitError(json.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      if (json.partial && json.partial.length > 0) setPartial(json.partial);
      router.push(`/ads/${json.adCampaignId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'cook failed');
      setSubmitting(false);
    }
  }

  const total = estimate?.total ?? 0;
  const insufficientBuzz =
    typeof buzzBalance === 'number' && total > 0 && total > buzzBalance && !estimateError;

  /* --------------------------------------------------------------- render */
  return (
    <div className="flex flex-col gap-6">
      <StepDots step={step} />

      {step === 'brief' && (
        <div className="flex flex-col gap-5" data-testid="ad-brief-step">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ad-title">campaign title</FieldLabel>
              <Input
                id="ad-title"
                value={brief.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="spring sale"
                data-testid="ad-title"
              />
            </div>
            <div>
              <FieldLabel htmlFor="ad-goal">campaign goal</FieldLabel>
              <Select
                id="ad-goal"
                value={brief.goal}
                onChange={(e) => update('goal', e.target.value)}
              >
                <option value="">—</option>
                {GOAL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="ad-desc">description</FieldLabel>
            <Textarea
              id="ad-desc"
              value={brief.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="describe the creative — product, vibe, setting. we'll use this as the prompt."
              data-testid="ad-description"
            />
            <p className="mt-1 font-mono text-[10.5px] text-fg-3">
              this doubles as the generation prompt — mixed with your brand DNA per size.
            </p>
          </div>

          <div>
            <FieldLabel htmlFor="ad-offer">offer or hook</FieldLabel>
            <Input
              id="ad-offer"
              value={brief.offer}
              onChange={(e) => update('offer', e.target.value)}
              placeholder="20% off bundle · early access · free shipping"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ad-audience">audience</FieldLabel>
              <Input
                id="ad-audience"
                value={brief.audience}
                onChange={(e) => update('audience', e.target.value)}
                placeholder="30s · urban · gift-giving"
              />
            </div>
            <div>
              <FieldLabel htmlFor="ad-aesthetics">aesthetics</FieldLabel>
              <Input
                id="ad-aesthetics"
                value={brief.aesthetics}
                onChange={(e) => update('aesthetics', e.target.value)}
                placeholder="festive · citrus-forward · golden hour"
              />
            </div>
          </div>

          <section>
            <FieldLabel>references</FieldLabel>
            <AssetCatalogPicker
              value={referenceAssetIds}
              onChange={setReferenceAssetIds}
              max={4}
            />
          </section>

          <section>
            <FieldLabel>ad sizes</FieldLabel>
            <AdSizePicker value={sizeIds} onChange={setSizeIds} />
          </section>

          <section className="rounded-[12px] border border-line-subtle bg-bg-2 p-3">
            <button
              type="button"
              onClick={() => setWithCopy((v) => !v)}
              aria-expanded={withCopy}
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2 hover:text-fg-0"
              data-testid="toggle-adcopy"
            >
              {withCopy ? (
                <ChevronUp size={12} strokeWidth={2} />
              ) : (
                <ChevronDown size={12} strokeWidth={2} />
              )}
              add headline / cta (optional)
            </button>
            {withCopy && (
              <div className="mt-3 flex flex-col gap-2">
                <Input
                  aria-label="headline"
                  value={copy.headline}
                  onChange={(e) => setCopy({ ...copy, headline: e.target.value })}
                  placeholder="headline"
                  data-testid="adcopy-headline"
                />
                <Textarea
                  aria-label="subhead"
                  value={copy.subhead}
                  onChange={(e) => setCopy({ ...copy, subhead: e.target.value })}
                  rows={2}
                  placeholder="subhead"
                  data-testid="adcopy-subhead"
                />
                <Input
                  aria-label="cta"
                  value={copy.cta}
                  onChange={(e) => setCopy({ ...copy, cta: e.target.value })}
                  placeholder="cta (optional)"
                  data-testid="adcopy-cta"
                />
                <p className="font-mono text-[10.5px] text-fg-3">
                  headline + subhead are baked into the creative; leave both blank to generate
                  text-free art.
                </p>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
            <span className="text-[12.5px] text-fg-3">
              {sizeIds.length} size{sizeIds.length === 1 ? '' : 's'} · one creative each.
            </span>
            <span className="flex-1" />
            <Button
              variant="primary"
              size="lg"
              onClick={() => setStep('review')}
              disabled={!canContinue}
              leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
              data-testid="ad-brief-continue"
            >
              review
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-5" data-testid="ad-review-step">
          <header className="flex flex-wrap items-center gap-3 border-b border-line-subtle pb-4">
            <span className="t-eyebrow">{'// '}review & cook</span>
            <span className="flex-1" />
            {estimating && (
              <span className="flex items-center gap-1 font-mono text-[11px] text-fg-3">
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                estimating…
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">total</span>
            {estimateError ? (
              <span className="font-mono text-[11.5px] text-fg-3" data-testid="estimate-unavailable">
                {estimateError}
              </span>
            ) : (
              <BuzzPill amount={total} data-testid="ad-total-buzz" />
            )}
          </header>

          <dl className="grid gap-3 text-[13.5px] md:grid-cols-2">
            <Summary label="title" value={brief.title} />
            <Summary label="goal" value={brief.goal || '—'} />
            <div className="md:col-span-2">
              <Summary label="description" value={brief.description} />
            </div>
            <Summary label="offer" value={brief.offer || '—'} />
            <Summary label="sizes" value={`${sizeIds.length} selected`} />
          </dl>

          {typeof buzzBalance === 'number' && (
            <p className="font-mono text-[11.5px] text-fg-3" data-testid="ad-buzz-balance">
              your balance · {buzzBalance.toLocaleString()} buzz
            </p>
          )}

          {partial && partial.length > 0 && (
            <div
              role="alert"
              className="rounded-[10px] border border-line-subtle bg-bg-3 px-3 py-2 font-mono text-[11.5px] text-fg-2"
              data-testid="ad-partial"
            >
              {partial.length} size{partial.length === 1 ? '' : 's'} failed to submit — the rest are
              cooking.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setStep('brief')}
              disabled={submitting}
              leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
              data-testid="ad-review-back"
            >
              back
            </Button>
            <span className="flex-1" />
            {submitError && (
              <span className="font-mono text-[11.5px] text-danger" data-testid="ad-submit-error">
                {submitError}
              </span>
            )}
            {insufficientBuzz && (
              <span
                className="font-mono text-[11.5px] text-danger"
                data-testid="ad-insufficient-buzz"
              >
                insufficient buzz ·{' '}
                <a
                  href={buzzTopUpUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-fg-0"
                >
                  top up
                </a>
              </span>
            )}
            <Button
              variant="primary"
              size="lg"
              onClick={doCook}
              disabled={submitting || insufficientBuzz}
              leadingIcon={
                submitting ? (
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <Sparkles size={14} strokeWidth={1.75} />
                )
              }
              data-testid="ad-cook"
            >
              {submitting
                ? 'cooking…'
                : total > 0
                  ? `cook for ${total.toLocaleString()} buzz`
                  : 'cook'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-line-subtle bg-bg-2 p-[10px]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">{label}</dt>
      <dd className="leading-[1.4] text-fg-0">{value}</dd>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'brief', label: 'brief' },
    { key: 'review', label: 'cook' },
  ];
  const idx = step === 'submit' ? 1 : steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="ad campaign wizard steps">
      {steps.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span
              role="tab"
              aria-selected={state === 'current'}
              data-state={state}
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.1em]',
                state === 'current' && 'text-fg-0',
                state === 'done' && 'text-volt',
                state === 'upcoming' && 'text-fg-3',
              )}
            >
              {`0${i + 1}`} · {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-line" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
