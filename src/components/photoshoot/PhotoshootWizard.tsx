'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Sparkles } from 'lucide-react';
import { Button, BuzzPill, Chip, FieldLabel, Input, Textarea, cn } from '@/components/ui';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import {
  PHOTOSHOOT_TEMPLATES,
  type PhotoshootRatio,
  type PhotoshootTemplate,
  type PhotoshootTemplateId,
} from '@/lib/photoshootTemplates';
import type { EnhancedPrompt } from '@/lib/promptBuilder';

const RATIOS: PhotoshootRatio[] = ['1:1', '4:5', '9:16', '16:9'];

const GROUP_LABEL: Record<PhotoshootTemplate['group'], string> = {
  studio: 'studio',
  lifestyle: 'lifestyle · in use',
  hero: 'hero',
};

const ALL_TEMPLATES: PhotoshootTemplate[] = Object.values(PHOTOSHOOT_TEMPLATES);

export type WizardStep = 'brief' | 'review' | 'submit';

export function isStep(value: string | null | undefined): value is WizardStep {
  return value === 'brief' || value === 'review' || value === 'submit';
}

/**
 * Build the request body for `POST /api/photoshoot/preview`. Pure helper —
 * exported so unit tests can lock the wire format without booting the wizard.
 */
export function buildPreviewPayload(
  brief: Brief,
  referenceAssetIds: string[],
): { brief: Brief; templateIds: PhotoshootTemplateId[]; referenceAssetIds: string[] } {
  return {
    brief,
    templateIds: brief.templateIds,
    referenceAssetIds,
  };
}

/**
 * Build the request body for `POST /api/photoshoot/cook`. Merges any
 * user-typed raw prompt overrides into the corresponding template's
 * `EnhancedPrompt.userOverride` field, leaving the rest of the prompt layers
 * intact so the audit trail keeps the brand-DNA composition.
 */
export function buildCookPayload(
  brief: Brief,
  referenceAssetIds: string[],
  enhancedFromPreview: Record<string, EnhancedPrompt> | undefined,
  userOverrides: Record<string, string>,
): Brief & {
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, EnhancedPrompt>;
} {
  const enhancedPrompts: Record<string, EnhancedPrompt> = {};
  for (const id of brief.templateIds) {
    const base = enhancedFromPreview?.[id];
    if (!base) continue;
    const trimmed = userOverrides[id]?.trim();
    enhancedPrompts[id] = {
      ...base,
      userOverride: trimmed ? trimmed : undefined,
    };
  }
  return { ...brief, referenceAssetIds, enhancedPrompts };
}

type PreviewResponse = {
  enhancedPrompts: Record<string, EnhancedPrompt>;
  estimatePerPreset: Record<string, number>;
  totalBuzz: number;
  errors?: Record<string, string>;
};

type CookResponse = {
  photoshootId?: string;
  id?: string;
  error?: string;
};

export type Brief = {
  productName: string;
  productNotes: string;
  ratio: PhotoshootRatio;
  variantsPerTemplate: number;
  templateIds: PhotoshootTemplateId[];
};

export type PhotoshootWizardProps = {
  buzzBalance?: number | null;
};

export function PhotoshootWizard({
  buzzBalance = null,
}: PhotoshootWizardProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams?.get('step');
  const step: WizardStep = isStep(rawStep) ? rawStep : 'brief';

  // --- brief state -----------------------------------------------------------
  const [productName, setProductName] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [ratio, setRatio] = useState<PhotoshootRatio>('4:5');
  const [variants, setVariants] = useState(1);
  const [templateIds, setTemplateIds] = useState<Set<PhotoshootTemplateId>>(
    () => new Set(ALL_TEMPLATES.filter((t) => t.defaultOn).map((t) => t.id)),
  );
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([]);

  // --- preview / review state ------------------------------------------------
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [userOverrides, setUserOverrides] = useState<Record<string, string>>({});

  // --- cook state ------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goStep = useCallback(
    (next: WizardStep) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('step', next);
      router.replace(`/photoshoot/new?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const toggleTemplate = useCallback((id: PhotoshootTemplateId) => {
    setTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const buildBrief = useCallback((): Brief => {
    return {
      productName: productName.trim() || 'untitled product',
      productNotes:
        productNotes.trim() ||
        'small-batch product · studio clean · brand-forward, no overlays',
      ratio,
      variantsPerTemplate: variants,
      templateIds: Array.from(templateIds),
    };
  }, [productName, productNotes, ratio, variants, templateIds]);

  /**
   * Fetch a fresh preview from the server. Buzz pricing depends on the
   * orchestrator estimate (image count, aspect, references) — not the prompt
   * text — so we re-fetch on override edits to keep the displayed total
   * grounded in a live estimate even when the user is mostly tweaking text.
   */
  const fetchPreview = useCallback(async () => {
    if (templateIds.size === 0) {
      setPreviewError('pick at least one template');
      return null;
    }
    setPreviewing(true);
    setPreviewError(null);
    try {
      const brief = buildBrief();
      const res = await fetch('/api/photoshoot/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildPreviewPayload(brief, referenceAssetIds)),
      });
      const json = (await res.json().catch(() => ({}))) as PreviewResponse & {
        error?: string;
      };
      if (!res.ok) {
        setPreviewError(json?.error ?? `http ${res.status}`);
        setPreviewing(false);
        return null;
      }
      setPreview(json);
      setPreviewing(false);
      return json;
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'preview failed');
      setPreviewing(false);
      return null;
    }
  }, [templateIds, buildBrief, referenceAssetIds]);

  // Debounced re-preview when overrides change while on the review step.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step !== 'review') return;
    if (Object.keys(userOverrides).length === 0) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchPreview();
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // intentionally re-run on overrides only; fetchPreview captures current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userOverrides, step]);

  // --- handlers --------------------------------------------------------------

  async function onContinueToReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const result = await fetchPreview();
    if (result) goStep('review');
  }

  async function onCook() {
    setSubmitError(null);
    setSubmitting(true);
    goStep('submit');
    try {
      const brief = buildBrief();
      const payload = buildCookPayload(
        brief,
        referenceAssetIds,
        preview?.enhancedPrompts,
        userOverrides,
      );
      const res = await fetch('/api/photoshoot/cook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as CookResponse;
      if (!res.ok) {
        setSubmitError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        goStep('review');
        return;
      }
      const id = body?.photoshootId ?? body?.id;
      if (!id) {
        setSubmitError('no photoshoot id returned');
        setSubmitting(false);
        goStep('review');
        return;
      }
      router.replace(`/photoshoot/${id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
      goStep('review');
    }
  }

  // --- derived ---------------------------------------------------------------
  const totalShots = templateIds.size * variants;
  const totalBuzz = preview?.totalBuzz ?? 0;

  const groups = useMemo(() => {
    const out: Record<PhotoshootTemplate['group'], PhotoshootTemplate[]> = {
      studio: [],
      lifestyle: [],
      hero: [],
    };
    for (const t of ALL_TEMPLATES) out[t.group].push(t);
    return out;
  }, []);

  // --- render ----------------------------------------------------------------
  return (
    <div className="relative pb-24" data-testid="photoshoot-wizard" data-step={step}>
      <header className="mx-auto max-w-[720px] text-center">
        <span className="t-eyebrow">
          // step 2 · shoot ·{' '}
          <span className="text-fg-1">
            {step === 'brief' ? 'brief' : step === 'review' ? 'review' : 'cooking'}
          </span>
        </span>
        <h1 className="mt-[6px] t-h1 text-fg-0">photoshoot.</h1>
        <p className="mx-auto mt-[6px] max-w-[540px] text-[15px] text-fg-2">
          one product → a studio set. brief, review, cook.
        </p>
        <StepDots step={step} />
      </header>

      {step === 'brief' && (
        <BriefStep
          productName={productName}
          productNotes={productNotes}
          setProductName={setProductName}
          setProductNotes={setProductNotes}
          ratio={ratio}
          setRatio={setRatio}
          variants={variants}
          setVariants={setVariants}
          templateIds={templateIds}
          toggleTemplate={toggleTemplate}
          groups={groups}
          referenceAssetIds={referenceAssetIds}
          setReferenceAssetIds={setReferenceAssetIds}
          totalShots={totalShots}
          previewing={previewing}
          previewError={previewError}
          onSubmit={onContinueToReview}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          brief={buildBrief()}
          preview={preview}
          previewing={previewing}
          previewError={previewError}
          totalBuzz={totalBuzz}
          userOverrides={userOverrides}
          setUserOverrides={setUserOverrides}
          submitError={submitError}
          onBack={() => goStep('brief')}
          onCook={onCook}
          buzzBalance={buzzBalance}
        />
      )}

      {step === 'submit' && <SubmitStep submitting={submitting} error={submitError} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* sub-components                                                              */
/* -------------------------------------------------------------------------- */

function StepDots({ step }: { step: WizardStep }) {
  const items: WizardStep[] = ['brief', 'review', 'submit'];
  return (
    <div
      className="mt-3 flex items-center justify-center gap-1.5"
      aria-label="wizard progress"
      data-testid="step-dots"
    >
      {items.map((s, i) => {
        const idx = items.indexOf(step);
        const reached = i <= idx;
        return (
          <span
            key={s}
            aria-current={s === step ? 'step' : undefined}
            className={cn(
              'h-1.5 w-6 rounded-pill transition-colors duration-fast',
              reached ? 'bg-volt' : 'bg-bg-3',
            )}
          />
        );
      })}
    </div>
  );
}

type BriefStepProps = {
  productName: string;
  productNotes: string;
  setProductName: (v: string) => void;
  setProductNotes: (v: string) => void;
  ratio: PhotoshootRatio;
  setRatio: (r: PhotoshootRatio) => void;
  variants: number;
  setVariants: (fn: (v: number) => number) => void;
  templateIds: Set<PhotoshootTemplateId>;
  toggleTemplate: (id: PhotoshootTemplateId) => void;
  groups: Record<PhotoshootTemplate['group'], PhotoshootTemplate[]>;
  referenceAssetIds: string[];
  setReferenceAssetIds: (ids: string[]) => void;
  totalShots: number;
  previewing: boolean;
  previewError: string | null;
  onSubmit: (e: React.FormEvent) => void;
};

function BriefStep(props: BriefStepProps) {
  const {
    productName,
    productNotes,
    setProductName,
    setProductNotes,
    ratio,
    setRatio,
    variants,
    setVariants,
    templateIds,
    toggleTemplate,
    groups,
    referenceAssetIds,
    setReferenceAssetIds,
    totalShots,
    previewing,
    previewError,
    onSubmit,
  } = props;

  return (
    <form onSubmit={onSubmit} data-testid="brief-step">
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

          <div className="mt-2">
            <FieldLabel>references · optional</FieldLabel>
            <AssetCatalogPicker
              value={referenceAssetIds}
              onChange={setReferenceAssetIds}
              max={4}
            />
          </div>
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
            {totalShots} shot{totalShots === 1 ? '' : 's'}
          </span>

          {previewError && (
            <span className="font-mono text-[11.5px] text-danger">{previewError}</span>
          )}

          <span className="flex-1" />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={previewing || templateIds.size === 0}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            {previewing ? 'estimating…' : 'preview & review'}
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

type ReviewStepProps = {
  brief: Brief;
  preview: PreviewResponse | null;
  previewing: boolean;
  previewError: string | null;
  totalBuzz: number;
  userOverrides: Record<string, string>;
  setUserOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitError: string | null;
  onBack: () => void;
  onCook: () => void;
  buzzBalance?: number | null;
};

function ReviewStep(props: ReviewStepProps) {
  const {
    brief,
    preview,
    previewing,
    previewError,
    totalBuzz,
    userOverrides,
    setUserOverrides,
    submitError,
    onBack,
    onCook,
    buzzBalance,
  } = props;
  const insufficientBuzz =
    typeof buzzBalance === 'number' && totalBuzz > buzzBalance;

  return (
    <div className="mx-auto mt-10 w-full max-w-[960px]" data-testid="review-step">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} leadingIcon={<ArrowLeft size={14} />}>
            back
          </Button>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3">
            {brief.templateIds.length} template{brief.templateIds.length === 1 ? '' : 's'} ·{' '}
            {brief.variantsPerTemplate} variant{brief.variantsPerTemplate === 1 ? '' : 's'} each
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3">
            total
          </span>
          <BuzzPill amount={totalBuzz} data-testid="total-buzz" />
        </div>
      </div>

      {previewError && (
        <div
          role="alert"
          className="mb-4 rounded-[12px] border border-line bg-bg-2 px-4 py-3 text-[13px] text-fg-1"
        >
          preview error — {previewError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {brief.templateIds.map((tid) => {
          const template = PHOTOSHOOT_TEMPLATES[tid];
          const enhanced = preview?.enhancedPrompts?.[tid];
          const buzz = preview?.estimatePerPreset?.[tid] ?? 0;
          const errorForId = preview?.errors?.[tid];
          const override = userOverrides[tid] ?? '';

          return (
            <TemplateReviewCard
              key={tid}
              template={template}
              enhanced={enhanced}
              buzz={buzz}
              ratio={enhanced?.aspectRatio ?? brief.ratio}
              error={errorForId}
              override={override}
              onOverrideChange={(value) =>
                setUserOverrides((prev) => {
                  if (!value) {
                    if (!(tid in prev)) return prev;
                    const next = { ...prev };
                    delete next[tid];
                    return next;
                  }
                  return { ...prev, [tid]: value };
                })
              }
            />
          );
        })}
      </div>

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-[12px] border border-line bg-bg-2 px-4 py-3 text-[13px] text-danger"
        >
          {submitError}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-line-subtle bg-bg-0/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-4 px-9 py-4">
          <Button variant="ghost" size="md" onClick={onBack} leadingIcon={<ArrowLeft size={14} />}>
            back
          </Button>
          <span className="flex-1" />
          {previewing && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3">
              re-estimating…
            </span>
          )}
          {insufficientBuzz && (
            <span
              className="font-mono text-[11.5px] text-danger"
              data-testid="insufficient-buzz"
            >
              insufficient buzz · {' '}
              <a
                href="https://civitai.com/purchase/buzz"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-fg-0"
              >
                top up
              </a>
            </span>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onCook}
            disabled={previewing || !preview || totalBuzz <= 0 || insufficientBuzz}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            data-testid="cook-button"
          >
            cook for {totalBuzz} buzz
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplateReviewCard({
  template,
  enhanced,
  buzz,
  ratio,
  error,
  override,
  onOverrideChange,
}: {
  template: PhotoshootTemplate;
  enhanced: EnhancedPrompt | undefined;
  buzz: number;
  ratio: PhotoshootRatio;
  error?: string;
  override: string;
  onOverrideChange: (value: string) => void;
}) {
  const [brandOpen, setBrandOpen] = useState(false);
  const [editing, setEditing] = useState(Boolean(override));

  const finalPrompt = enhanced?.finalPrompt ?? '';

  return (
    <article
      data-testid="template-card"
      data-template-id={template.id}
      className="rounded-[14px] border border-line-subtle bg-bg-2 p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-fg-0">
          {template.label}
        </h3>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
          // {GROUP_LABEL[template.group]}
        </span>
        <Chip ghost active>
          {ratio}
        </Chip>
        <span className="flex-1" />
        <BuzzPill amount={buzz} size="compact" data-testid="template-buzz" />
      </header>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[10px] border border-line bg-bg-3 px-3 py-2 font-mono text-[11px] text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-4">
        <FieldLabel>final prompt</FieldLabel>
        <p className="rounded-[10px] border border-line-subtle bg-bg-3 px-3 py-2 text-[13px] leading-[1.5] text-fg-1">
          {override.trim() ? override : finalPrompt || '—'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setBrandOpen((v) => !v)}
          aria-expanded={brandOpen}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 hover:text-fg-0"
          data-testid="brand-toggle"
        >
          {brandOpen ? '− hide' : '+ show'} what we added from your brand
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          className={cn(
            'inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em]',
            editing ? 'text-volt' : 'text-fg-2 hover:text-fg-0',
          )}
          data-testid="edit-toggle"
        >
          {editing ? '− editing raw prompt' : '+ edit raw prompt'}
        </button>
      </div>

      {brandOpen && enhanced && (
        <div className="mt-3 rounded-[10px] border border-line-subtle bg-bg-3 px-3 py-3 text-[12.5px] leading-[1.5]">
          <Layer label="brand" value={enhanced.brandLayer} />
          <Layer label="style" value={enhanced.styleLayer} />
          <Layer label="base" value={enhanced.base} />
          {enhanced.negativePrompt && (
            <Layer label="negative" value={enhanced.negativePrompt} />
          )}
        </div>
      )}

      {editing && (
        <div className="mt-3">
          <FieldLabel htmlFor={`override-${template.id}`}>raw prompt override</FieldLabel>
          <Textarea
            id={`override-${template.id}`}
            value={override}
            onChange={(e) => onOverrideChange(e.target.value)}
            rows={4}
            placeholder={finalPrompt}
            data-testid={`override-textarea-${template.id}`}
          />
          <p className="mt-1 font-mono text-[10.5px] text-fg-3">
            edits re-estimate buzz cost automatically.
          </p>
        </div>
      )}
    </article>
  );
}

function Layer({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 [&:not(:last-child)]:mb-2">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">
        {label}
      </span>
      <span className="text-fg-1">{value}</span>
    </div>
  );
}

function SubmitStep({
  submitting,
  error,
}: {
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div
      className="mx-auto mt-20 flex max-w-[480px] flex-col items-center gap-4 text-center"
      data-testid="submit-step"
    >
      <div
        className={cn(
          'grid h-14 w-14 place-items-center rounded-pill bg-volt-soft text-volt',
          submitting && 'animate-pulse',
        )}
      >
        <Sparkles size={22} strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.015em] text-fg-0">
        {error ? 'submit failed' : 'cooking your photoshoot…'}
      </h2>
      <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-fg-3">
        {error
          ? error
          : 'queueing workflows · charging buzz · about to redirect'}
      </p>
    </div>
  );
}
