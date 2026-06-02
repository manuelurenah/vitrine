'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  Badge,
  BuzzPill,
  Button,
  Chip,
  FieldLabel,
  Input,
  Textarea,
  cn,
} from '@/components/ui';
import { PresetGrid } from './PresetGrid';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import type { EnhancedPrompt } from '@/lib/promptBuilder';
import {
  fetchCampaignPreview,
  useCampaignPreview,
  type CampaignPreviewResponse,
  type FetchPreviewArgs,
  type PreviewBrief,
} from '@/hooks/useCampaignPreview';

export type CampaignWizardInitial = {
  brandName?: string | null;
  productCount?: number;
  assetCount?: number;
  defaultBrief?: Partial<PreviewBrief & { presetIds: string[] }>;
  defaultReferenceAssetIds?: string[];
};

type Props = {
  initial?: CampaignWizardInitial;
  /** Test seam — defaults to window.fetch. */
  fetcher?: typeof fetch;
};

type Step = 'brief' | 'review' | 'submit';

const STEP_ORDER: Step[] = ['brief', 'review', 'submit'];

function parseStep(raw: string | null): Step {
  if (raw === 'review' || raw === 'submit') return raw;
  return 'brief';
}

const DEFAULT_PROMPT =
  'launch the four-piece chili oil sampler for summer. festive, citrus-forward, loud.';

const DEFAULT_BRIEF: PreviewBrief = {
  prompt: DEFAULT_PROMPT,
  title: "summer heat sampler '26",
  description:
    'four chili oils, four moods. bright, citrus-forward photography, festive energy, no holiday clichés.',
  goal: 'launch',
  offer: '20% off bundle',
  audience: '',
  aesthetics: '',
};

const DEFAULT_PRESETS = ['ig-feed', 'ig-story', 'li'];

/**
 * 3-step campaign wizard. Step state lives in the URL (`?step=...`) so
 * refresh-safe, browser-back-friendly. Form state is lifted into this
 * component and persists across step changes within the same session.
 */
export function CampaignWizard({ initial, fetcher }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = parseStep(searchParams.get('step'));

  /* ---------------------------------------------------------------- step 1 */
  const [brief, setBrief] = useState<PreviewBrief>(() => ({
    ...DEFAULT_BRIEF,
    ...(initial?.defaultBrief ?? {}),
  }));
  const [presetIds, setPresetIds] = useState<string[]>(
    () => initial?.defaultBrief?.presetIds ?? DEFAULT_PRESETS,
  );
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>(
    () => initial?.defaultReferenceAssetIds ?? [],
  );
  const [variantsPerPreset, setVariantsPerPreset] = useState<number>(1);

  /* ---------------------------------------------------------------- step 2 */
  const { preview, loading, error, run, schedule, setPreview } =
    useCampaignPreview({ fetcher });
  const [userOverrides, setUserOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [showBrandLayer, setShowBrandLayer] = useState<Record<string, boolean>>({});
  const [perPresetLoading, setPerPresetLoading] = useState<Record<string, boolean>>({});

  /* ---------------------------------------------------------------- step 3 */
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ----------------------------------------------------- url step transitions */
  const goToStep = useCallback(
    (next: Step) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === 'brief') sp.delete('step');
      else sp.set('step', next);
      const qs = sp.toString();
      router.replace(qs ? `/campaigns/new?${qs}` : `/campaigns/new`);
    },
    [router, searchParams],
  );

  /* ----------------------------------------- step → submit auto-run on enter */
  const submitInFlightRef = useRef(false);
  useEffect(() => {
    if (step !== 'submit') return;
    if (submitInFlightRef.current) return;
    if (!preview) {
      // Cannot submit without a preview baseline. Bounce back to review.
      goToStep('review');
      return;
    }
    submitInFlightRef.current = true;
    void doCook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const formArgs = useMemo<FetchPreviewArgs>(
    () => ({ brief, presetIds, variantsPerPreset, referenceAssetIds }),
    [brief, presetIds, variantsPerPreset, referenceAssetIds],
  );

  /* ---------------------------------------------------------- brief → review */
  const [briefError, setBriefError] = useState<string | null>(null);
  async function handleContinueToReview(e: React.FormEvent) {
    e.preventDefault();
    setBriefError(null);
    if (presetIds.length === 0) {
      setBriefError('pick at least one preset');
      return;
    }
    if (!brief.title.trim() || !brief.description.trim()) {
      setBriefError('title and description are required');
      return;
    }
    const res = await run(formArgs);
    if (!res) return;
    // Reset overrides whenever a fresh preview lands from step 1.
    setUserOverrides({});
    setEditing({});
    goToStep('review');
  }

  /* ----------------------------- per-preset re-preview when override changes */
  function handleOverrideChange(presetId: string, value: string) {
    setUserOverrides((prev) => ({ ...prev, [presetId]: value }));
    setPerPresetLoading((prev) => ({ ...prev, [presetId]: true }));

    // Re-preview the entire batch (route is parallel; cheap enough). We pass
    // the current overrides so the server sees them as `userOverride` on each
    // preset's enhanced prompt. The route doesn't yet accept overrides on
    // preview, so we re-run with the same args and then merge our override
    // back into the response (which is what the UI displays anyway). The
    // estimate from the server is for the non-overridden prompt, which is a
    // reasonable upper bound — when the user submits we re-estimate against
    // the override on the cook side.
    schedule(formArgs);
  }

  // Clear per-preset loading flags when a new preview lands.
  useEffect(() => {
    if (!loading) setPerPresetLoading({});
  }, [loading, preview]);

  /* -------------------------------------------------------------- review → submit */
  async function handleCook() {
    setSubmitError(null);
    goToStep('submit');
  }

  async function doCook() {
    if (!preview) {
      setSubmitError('preview missing');
      goToStep('review');
      submitInFlightRef.current = false;
      return;
    }
    setSubmitting(true);
    try {
      // Apply user overrides onto the preview's enhanced prompts.
      const enhancedPrompts: Record<string, EnhancedPrompt> = {};
      for (const id of presetIds) {
        const ep = preview.enhancedPrompts[id];
        if (!ep) continue;
        const override = userOverrides[id]?.trim();
        enhancedPrompts[id] = { ...ep, userOverride: override || undefined };
      }
      const body = {
        prompt: brief.prompt,
        title: brief.title,
        description: brief.description,
        goal: brief.goal,
        offer: brief.offer,
        audience: brief.audience,
        aesthetics: brief.aesthetics,
        presetIds,
        referenceAssetIds,
        variantsPerPreset,
        enhancedPrompts,
      };
      const f = fetcher ?? fetch;
      const res = await f('/api/campaigns/cook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        campaignId?: string;
        error?: string;
      };
      if (!res.ok) {
        setSubmitError(json.error ?? `http ${res.status}`);
        setSubmitting(false);
        submitInFlightRef.current = false;
        goToStep('review');
        return;
      }
      if (!json.campaignId) {
        setSubmitError('no campaign id returned');
        setSubmitting(false);
        submitInFlightRef.current = false;
        goToStep('review');
        return;
      }
      router.replace(`/campaigns/${json.campaignId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'cook failed');
      setSubmitting(false);
      submitInFlightRef.current = false;
      goToStep('review');
    }
  }

  /* --------------------------------------------------------------- rendering */
  return (
    <div className="flex flex-col gap-6">
      <StepDots step={step} />
      {step === 'brief' && (
        <BriefStep
          brief={brief}
          setBrief={setBrief}
          presetIds={presetIds}
          setPresetIds={setPresetIds}
          referenceAssetIds={referenceAssetIds}
          setReferenceAssetIds={setReferenceAssetIds}
          variantsPerPreset={variantsPerPreset}
          setVariantsPerPreset={setVariantsPerPreset}
          loading={loading}
          error={briefError ?? error}
          onContinue={handleContinueToReview}
        />
      )}
      {step === 'review' && (
        <ReviewStep
          preview={preview}
          presetIds={presetIds}
          variantsPerPreset={variantsPerPreset}
          editing={editing}
          setEditing={setEditing}
          userOverrides={userOverrides}
          showBrandLayer={showBrandLayer}
          setShowBrandLayer={setShowBrandLayer}
          perPresetLoading={perPresetLoading}
          onOverrideChange={handleOverrideChange}
          onBack={() => goToStep('brief')}
          onCook={handleCook}
          error={error}
        />
      )}
      {step === 'submit' && (
        <SubmitStep submitting={submitting} error={submitError} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* step dots                                                                   */
/* -------------------------------------------------------------------------- */

function StepDots({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div
      className="flex items-center gap-2"
      role="tablist"
      aria-label="campaign wizard steps"
      data-step={step}
    >
      {STEP_ORDER.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
        return (
          <div key={s} className="flex items-center gap-2">
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
              {`0${i + 1}`} · {s}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className="h-px w-6 bg-line" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* step 1: brief                                                               */
/* -------------------------------------------------------------------------- */

type BriefStepProps = {
  brief: PreviewBrief;
  setBrief: (next: PreviewBrief) => void;
  presetIds: string[];
  setPresetIds: (ids: string[]) => void;
  referenceAssetIds: string[];
  setReferenceAssetIds: (ids: string[]) => void;
  variantsPerPreset: number;
  setVariantsPerPreset: (n: number) => void;
  loading: boolean;
  error: string | null;
  onContinue: (e: React.FormEvent) => void;
};

function BriefStep({
  brief,
  setBrief,
  presetIds,
  setPresetIds,
  referenceAssetIds,
  setReferenceAssetIds,
  variantsPerPreset,
  setVariantsPerPreset,
  loading,
  error,
  onContinue,
}: BriefStepProps) {
  function update<K extends keyof PreviewBrief>(key: K, value: PreviewBrief[K]) {
    setBrief({ ...brief, [key]: value });
  }
  const totalCreatives = presetIds.length * variantsPerPreset;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={onContinue}
      data-testid="brief-step"
    >
      <section className="rounded-[14px] border border-line-subtle bg-bg-2 p-4">
        <span className="t-eyebrow">// you wrote</span>
        <p className="mt-2 text-[14.5px] leading-[1.5] text-fg-0">{brief.prompt}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip leadingIcon={<ShoppingBag size={12} strokeWidth={1.75} />}>
            chili oil · catalog
          </Chip>
          <Chip leadingIcon={<ImageIcon size={12} strokeWidth={1.75} />}>
            {totalCreatives} creative{totalCreatives === 1 ? '' : 's'}
          </Chip>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="brief-title">campaign title</FieldLabel>
          <Input
            id="brief-title"
            value={brief.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="brief-goal">campaign goal</FieldLabel>
          <Input
            id="brief-goal"
            value={brief.goal}
            onChange={(e) => update('goal', e.target.value)}
            placeholder="launch · awareness · sale · lifestyle"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="brief-desc">description</FieldLabel>
        <Textarea
          id="brief-desc"
          value={brief.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <FieldLabel htmlFor="brief-offer">offer or hook</FieldLabel>
        <Input
          id="brief-offer"
          value={brief.offer}
          onChange={(e) => update('offer', e.target.value)}
          placeholder="20% off bundle · early access · free shipping"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="brief-audience">audience</FieldLabel>
          <Input
            id="brief-audience"
            value={brief.audience}
            onChange={(e) => update('audience', e.target.value)}
            placeholder="30s · urban · gift-giving"
          />
        </div>
        <div>
          <FieldLabel htmlFor="brief-aesthetics">aesthetics</FieldLabel>
          <Input
            id="brief-aesthetics"
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

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="brief-variants">variants per preset</FieldLabel>
          <VariantsStepper
            value={variantsPerPreset}
            onChange={setVariantsPerPreset}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>total creatives</FieldLabel>
          <div className="font-mono text-[15px] text-fg-0">
            {presetIds.length} preset{presetIds.length === 1 ? '' : 's'} ×{' '}
            {variantsPerPreset} = {totalCreatives}
          </div>
        </div>
      </section>

      <section>
        <FieldLabel>output formats</FieldLabel>
        <PresetGrid onChange={setPresetIds} />
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line-subtle pt-4">
        <span className="text-[12.5px] text-fg-3">
          we&rsquo;ll preview the enhanced prompt + estimate per preset before you cook.
        </span>
        <span className="flex-1" />
        {error && (
          <span
            className="font-mono text-[11.5px] text-danger"
            data-testid="brief-error"
          >
            {error}
          </span>
        )}
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={loading || presetIds.length === 0}
          leadingIcon={
            loading ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={1.75} />
            )
          }
          data-testid="brief-continue"
        >
          {loading ? 'estimating…' : 'preview & review'}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* variants stepper                                                            */
/* -------------------------------------------------------------------------- */

function VariantsStepper({
  value,
  onChange,
  min = 1,
  max = 8,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div
      className="inline-flex items-center gap-2"
      data-testid="variants-stepper"
    >
      <button
        type="button"
        aria-label="decrement variants"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-bg-2 text-fg-1',
          'hover:border-line-strong hover:text-fg-0 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <span
        className="min-w-[2.5ch] text-center font-mono text-[15px] text-fg-0"
        data-testid="variants-value"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="increment variants"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-bg-2 text-fg-1',
          'hover:border-line-strong hover:text-fg-0 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* step 2: review                                                              */
/* -------------------------------------------------------------------------- */

type ReviewStepProps = {
  preview: CampaignPreviewResponse | null;
  presetIds: string[];
  variantsPerPreset: number;
  editing: Record<string, boolean>;
  setEditing: (next: Record<string, boolean>) => void;
  userOverrides: Record<string, string>;
  showBrandLayer: Record<string, boolean>;
  setShowBrandLayer: (next: Record<string, boolean>) => void;
  perPresetLoading: Record<string, boolean>;
  onOverrideChange: (presetId: string, value: string) => void;
  onBack: () => void;
  onCook: () => void;
  error: string | null;
};

function ReviewStep({
  preview,
  presetIds,
  variantsPerPreset,
  editing,
  setEditing,
  userOverrides,
  showBrandLayer,
  setShowBrandLayer,
  perPresetLoading,
  onOverrideChange,
  onBack,
  onCook,
  error,
}: ReviewStepProps) {
  if (!preview) {
    return (
      <div
        className="rounded-[14px] border border-line-subtle bg-bg-2 p-6 text-center text-[13.5px] text-fg-2"
        data-testid="review-empty"
      >
        no preview yet. head back to the brief and continue.
      </div>
    );
  }
  const total = preview.totalBuzz;
  return (
    <div className="flex flex-col gap-5" data-testid="review-step">
      <header className="flex flex-wrap items-center gap-3 border-b border-line-subtle pb-4">
        <span className="t-eyebrow">// step 2 · review enhanced prompts</span>
        <span className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">
          total estimate
        </span>
        <BuzzPill amount={total} data-testid="total-buzz" />
      </header>

      <div className="grid gap-4">
        {presetIds.map((id) => {
          const ep = preview.enhancedPrompts[id];
          const estimate = preview.estimatePerPreset[id] ?? 0;
          const errMsg = preview.errors?.[id];
          const isEditing = !!editing[id];
          const showBrand = !!showBrandLayer[id];
          const isLoading = !!perPresetLoading[id];
          const overrideValue = userOverrides[id] ?? '';
          return (
            <article
              key={id}
              className="rounded-[14px] border border-line-subtle bg-bg-2 p-4"
              data-testid={`preset-card-${id}`}
              data-preset-id={id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] text-fg-0">{id}</span>
                {ep && (
                  <Chip ghost data-testid={`ratio-${id}`}>
                    {ep.aspectRatio}
                  </Chip>
                )}
                <Badge kind="gen">{variantsPerPreset}×</Badge>
                <span className="flex-1" />
                {isLoading && (
                  <span
                    className="flex items-center gap-1 font-mono text-[11px] text-fg-3"
                    data-testid={`re-estimating-${id}`}
                  >
                    <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                    re-estimating…
                  </span>
                )}
                <BuzzPill
                  amount={estimate}
                  size="compact"
                  data-testid={`buzz-${id}`}
                />
              </div>

              {errMsg && (
                <p
                  className="mt-2 font-mono text-[11.5px] text-danger"
                  data-testid={`error-${id}`}
                >
                  {errMsg}
                </p>
              )}

              {ep && (
                <>
                  <p
                    className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-fg-1"
                    data-testid={`final-prompt-${id}`}
                  >
                    {overrideValue.trim() ? overrideValue : ep.finalPrompt}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowBrandLayer({ ...showBrandLayer, [id]: !showBrand })
                    }
                    aria-expanded={showBrand}
                    className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2 hover:text-fg-0"
                    data-testid={`toggle-brand-${id}`}
                  >
                    {showBrand ? (
                      <ChevronUp size={12} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={12} strokeWidth={2} />
                    )}
                    what we added from your brand
                  </button>
                  {showBrand && (
                    <div
                      className="mt-2 rounded-[10px] border border-line-subtle bg-bg-3 p-3 text-[12.5px] leading-[1.5] text-fg-1"
                      data-testid={`brand-layer-${id}`}
                    >
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">
                          brand layer
                        </span>
                        <p className="mt-1 whitespace-pre-wrap">
                          {ep.brandLayer || '— (no brand DNA yet)'}
                        </p>
                      </div>
                      <div className="mt-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3">
                          style layer
                        </span>
                        <p className="mt-1 whitespace-pre-wrap">{ep.styleLayer}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, [id]: !isEditing })
                      }
                      aria-pressed={isEditing}
                      className={cn(
                        'inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em]',
                        isEditing ? 'text-volt' : 'text-fg-2 hover:text-fg-0',
                      )}
                      data-testid={`toggle-edit-${id}`}
                    >
                      <Pencil size={12} strokeWidth={2} />
                      {isEditing ? 'editing raw prompt' : 'edit raw prompt'}
                    </button>
                  </div>
                  {isEditing && (
                    <div className="mt-2">
                      <Textarea
                        rows={4}
                        value={overrideValue || ep.finalPrompt}
                        onChange={(e) => onOverrideChange(id, e.target.value)}
                        data-testid={`override-input-${id}`}
                        aria-label={`raw prompt override for ${id}`}
                      />
                      <p className="mt-1 font-mono text-[10.5px] text-fg-3">
                        edits replace the assembled prompt sent to the
                        orchestrator. re-estimates after a short pause.
                      </p>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
        <Button
          variant="secondary"
          size="md"
          onClick={onBack}
          leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
          data-testid="review-back"
        >
          back
        </Button>
        <span className="flex-1" />
        {error && (
          <span
            className="font-mono text-[11.5px] text-danger"
            data-testid="review-error"
          >
            {error}
          </span>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={onCook}
          leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          data-testid="review-cook"
        >
          cook for {total.toLocaleString()} buzz
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* step 3: submit                                                              */
/* -------------------------------------------------------------------------- */

function SubmitStep({
  submitting,
  error,
}: {
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-10 text-center"
      data-testid="submit-step"
    >
      {submitting && (
        <>
          <Loader2 size={24} strokeWidth={1.75} className="animate-spin text-volt" />
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-fg-2">
            submitting…
          </span>
          <span className="text-[12.5px] text-fg-3">
            cooking workflows. you&rsquo;ll land on the campaign page in a moment.
          </span>
        </>
      )}
      {!submitting && error && (
        <span
          className="font-mono text-[11.5px] text-danger"
          data-testid="submit-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}

/* re-export for direct testing without going through the hook --------------- */
export { fetchCampaignPreview };
