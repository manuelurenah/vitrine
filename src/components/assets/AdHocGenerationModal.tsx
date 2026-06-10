'use client';

import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import { Button, BuzzPill, Chip, cn, FieldLabel, Modal, Textarea } from '@/components/ui';

/* -------------------------------------------------------------------------- */
/* types                                                                       */
/* -------------------------------------------------------------------------- */

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';
export type Resolution = '1K' | '2K';

export type AdHocFormState = {
  prompt: string;
  negativePrompt: string;
  aspectRatio: AspectRatio;
  numImages: number;
  resolution: Resolution;
  referenceAssetIds: string[];
};

export type ModalPhase = 'form' | 'polling' | 'results';

export type AdHocGenerationModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (count: number) => void;
  /** Test-only override to short-circuit the phase state machine on first render. */
  initialPhase?: ModalPhase;
  /** Test-only override for results-state rendering. */
  initialResults?: ResultsState;
  /** Test-only override for default form state (handy for SSR snapshot tests). */
  initialForm?: Partial<AdHocFormState>;
  /** Test-only override for the in-flight workflow id surfaced in the polling state. */
  initialWorkflowId?: string | null;
};

export type ResultsState = {
  workflowId: string;
  imageUrls: string[];
  selected: number[];
};

const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
const RESOLUTIONS: Resolution[] = ['1K', '2K'];
const MIN_IMAGES = 1;
const MAX_IMAGES = 4;
const MAX_REFERENCES = 4;

export const DEFAULT_AD_HOC_FORM: AdHocFormState = {
  prompt: '',
  negativePrompt: '',
  aspectRatio: '1:1',
  numImages: 1,
  resolution: '1K',
  referenceAssetIds: [],
};

/* -------------------------------------------------------------------------- */
/* pure helpers — exported for unit testing                                    */
/* -------------------------------------------------------------------------- */

export function clampNumImages(n: number): number {
  if (!Number.isFinite(n)) return MIN_IMAGES;
  return Math.max(MIN_IMAGES, Math.min(MAX_IMAGES, Math.trunc(n)));
}

export function toggleSelectedIndex(current: number[], idx: number): number[] {
  const next = new Set(current);
  if (next.has(idx)) next.delete(idx);
  else next.add(idx);
  return Array.from(next).sort((a, b) => a - b);
}

/* -------------------------------------------------------------------------- */
/* main component                                                              */
/* -------------------------------------------------------------------------- */

export function AdHocGenerationModal(props: AdHocGenerationModalProps) {
  // Re-mount the stateful inner component every time `open` flips, so
  // transient state (phase, results, in-flight workflow id, etc.) resets to
  // its initial values on each fresh open without needing a state-resetting
  // effect.
  return <AdHocGenerationModalInner key={props.open ? 'open' : 'closed'} {...props} />;
}

function AdHocGenerationModalInner({
  open,
  onClose,
  onSaved,
  initialPhase = 'form',
  initialResults,
  initialForm,
  initialWorkflowId = null,
}: AdHocGenerationModalProps) {
  const [phase, setPhase] = useState<ModalPhase>(initialPhase);
  const [form, setForm] = useState<AdHocFormState>(() => ({
    ...DEFAULT_AD_HOC_FORM,
    ...(initialForm ?? {}),
  }));
  const [refsExpanded, setRefsExpanded] = useState<boolean>(
    (initialForm?.referenceAssetIds?.length ?? 0) > 0,
  );
  const [negExpanded, setNegExpanded] = useState<boolean>(Boolean(initialForm?.negativePrompt));
  const [workflowId, setWorkflowId] = useState<string | null>(initialWorkflowId);
  const [estimatedBuzz, setEstimatedBuzz] = useState<number | null>(null);
  const [generationPrompt, setGenerationPrompt] = useState<string>('');
  const [results, setResults] = useState<ResultsState | null>(initialResults ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewEstimate, setPreviewEstimate] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /* ---- effects --------------------------------------------------------- */

  // Debounced whatif estimate. Re-runs whenever a cost-affecting form field
  // changes; coalesces rapid edits via a 350ms timer + AbortController on the
  // in-flight request. Skipped entirely when the prompt is empty (no API call
  // for invalid form state).
  useEffect(() => {
    if (!open) return;
    if (phase !== 'form') return;
    const promptTrimmed = form.prompt.trim();
    if (promptTrimmed.length === 0) {
      setPreviewEstimate(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch('/api/assets/generate/estimate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: promptTrimmed,
            negativePrompt: form.negativePrompt.trim() || undefined,
            aspectRatio: form.aspectRatio,
            numImages: clampNumImages(form.numImages),
            resolution: form.resolution,
            referenceAssetIds: form.referenceAssetIds,
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const body = (await res.json().catch(() => ({}))) as {
          estimatedBuzz?: number;
          error?: string;
        };
        if (!res.ok) {
          setPreviewEstimate(null);
          setPreviewError(body?.error ?? `http ${res.status}`);
        } else {
          setPreviewEstimate(body.estimatedBuzz ?? 0);
        }
      } catch (err) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setPreviewEstimate(null);
        setPreviewError(err instanceof Error ? err.message : 'estimate failed');
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    open,
    phase,
    form.prompt,
    form.negativePrompt,
    form.aspectRatio,
    form.numImages,
    form.resolution,
    form.referenceAssetIds,
  ]);

  // Long-poll the workflow while we're in the polling phase.
  useEffect(() => {
    if (!open) return;
    if (phase !== 'polling') return;
    if (!workflowId) return;

    let cancelled = false;

    async function loop(id: string) {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${id}?wait=15000`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (cancelled) return;
            setError(body?.error ?? `http ${res.status}`);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          if (data.done) {
            const urls = extractImageUrls(data.snapshot);
            setResults({ workflowId: id, imageUrls: urls, selected: [] });
            setPhase('results');
            return;
          }
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'poll failed');
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    loop(workflowId);
    return () => {
      cancelled = true;
    };
  }, [open, phase, workflowId]);

  /* ---- handlers -------------------------------------------------------- */

  const onGenerate = useCallback(async () => {
    if (!form.prompt.trim()) {
      setError('prompt is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/assets/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: form.prompt.trim(),
          negativePrompt: form.negativePrompt.trim() || undefined,
          aspectRatio: form.aspectRatio,
          numImages: clampNumImages(form.numImages),
          resolution: form.resolution,
          referenceAssetIds: form.referenceAssetIds,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        workflowId?: string;
        estimatedBuzz?: number;
        error?: string;
      };
      if (!res.ok || !body.workflowId) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      setWorkflowId(body.workflowId);
      setEstimatedBuzz(body.estimatedBuzz ?? null);
      setGenerationPrompt(form.prompt.trim());
      setPhase('polling');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generation failed');
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const onSaveSelected = useCallback(async () => {
    if (!results) return;
    if (results.selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/assets/generate/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowId: results.workflowId,
          imageIndexes: results.selected,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        savedAssetIds?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSaving(false);
        return;
      }
      const count = body.savedAssetIds?.length ?? results.selected.length;
      onSaved?.(count);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }, [results, onSaved, onClose]);

  const onDiscard = useCallback(() => {
    onClose();
  }, [onClose]);

  /* ---- render ---------------------------------------------------------- */

  const numImages = clampNumImages(form.numImages);

  const eyebrow = useMemo(() => {
    if (phase === 'polling') return 'ad-hoc generation · cooking';
    if (phase === 'results') return 'ad-hoc generation · review';
    return 'ad-hoc generation';
  }, [phase]);

  const title = useMemo(() => {
    if (phase === 'polling') return 'generating…';
    if (phase === 'results') return 'pick what to save.';
    return 'generate an image.';
  }, [phase]);

  return (
    <Modal open={open} onClose={onClose} eyebrow={eyebrow} title={title} maxWidth={760}>
      {phase === 'form' && (
        <FormView
          form={form}
          setForm={setForm}
          refsExpanded={refsExpanded}
          setRefsExpanded={setRefsExpanded}
          negExpanded={negExpanded}
          setNegExpanded={setNegExpanded}
          numImages={numImages}
          submitting={submitting}
          error={error}
          previewEstimate={previewEstimate}
          previewLoading={previewLoading}
          previewError={previewError}
          onGenerate={onGenerate}
          onClose={onClose}
        />
      )}

      {phase === 'polling' && (
        <PollingView
          numImages={numImages}
          prompt={generationPrompt}
          estimatedBuzz={estimatedBuzz}
          error={error}
          onClose={onClose}
        />
      )}

      {phase === 'results' && results && (
        <ResultsView
          results={results}
          aspectRatio={form.aspectRatio}
          saving={saving}
          error={error}
          onToggleIndex={(idx) =>
            setResults({
              ...results,
              selected: toggleSelectedIndex(results.selected, idx),
            })
          }
          onSaveSelected={onSaveSelected}
          onDiscard={onDiscard}
        />
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* form view                                                                   */
/* -------------------------------------------------------------------------- */

type FormViewProps = {
  form: AdHocFormState;
  setForm: (next: AdHocFormState) => void;
  refsExpanded: boolean;
  setRefsExpanded: (v: boolean) => void;
  negExpanded: boolean;
  setNegExpanded: (v: boolean) => void;
  numImages: number;
  submitting: boolean;
  error: string | null;
  previewEstimate?: number | null;
  previewLoading?: boolean;
  previewError?: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

export function FormView({
  form,
  setForm,
  refsExpanded,
  setRefsExpanded,
  negExpanded,
  setNegExpanded,
  numImages,
  submitting,
  error,
  previewEstimate = null,
  previewLoading = false,
  previewError = null,
  onGenerate,
  onClose,
}: FormViewProps) {
  const promptInvalid = form.prompt.trim().length === 0;
  return (
    <div className="flex flex-col gap-5" data-testid="adhoc-form">
      {/* prompt */}
      <div>
        <FieldLabel htmlFor="adhoc-prompt">prompt</FieldLabel>
        <Textarea
          id="adhoc-prompt"
          rows={4}
          maxLength={4000}
          required
          placeholder="describe what you want to generate…"
          value={form.prompt}
          aria-invalid={promptInvalid ? true : undefined}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
        <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
          <span>required</span>
          <span>{form.prompt.length} / 4000</span>
        </div>
      </div>

      {/* negative prompt — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setNegExpanded(!negExpanded)}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2 hover:text-fg-0"
          aria-expanded={negExpanded}
          aria-controls="adhoc-neg"
          data-testid="adhoc-neg-toggle"
        >
          {negExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {negExpanded ? '− negative prompt' : '+ negative prompt'}
        </button>
        {negExpanded && (
          <div id="adhoc-neg" className="mt-2" data-testid="adhoc-neg-region">
            <Textarea
              rows={2}
              placeholder="things to avoid (optional)"
              value={form.negativePrompt}
              onChange={(e) => setForm({ ...form, negativePrompt: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* aspect ratio */}
      <div>
        <FieldLabel>aspect ratio</FieldLabel>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="aspect ratio">
          {ASPECT_RATIOS.map((ratio) => {
            const active = form.aspectRatio === ratio;
            return (
              <Chip
                key={ratio}
                active={active}
                role="button"
                aria-pressed={active}
                data-testid={`adhoc-aspect-${ratio}`}
                onClick={() => setForm({ ...form, aspectRatio: ratio })}
              >
                {ratio}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* num images + resolution */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <FieldLabel>images</FieldLabel>
          <div className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-bg-2 px-2 py-1">
            <button
              type="button"
              aria-label="decrease images"
              data-testid="adhoc-num-dec"
              disabled={numImages <= MIN_IMAGES}
              onClick={() => setForm({ ...form, numImages: clampNumImages(numImages - 1) })}
              className="grid h-7 w-7 place-items-center rounded-[7px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
            >
              −
            </button>
            <span
              className="min-w-[1.25rem] text-center font-mono text-[13px] text-fg-0"
              data-testid="adhoc-num-value"
            >
              {numImages}
            </span>
            <button
              type="button"
              aria-label="increase images"
              data-testid="adhoc-num-inc"
              disabled={numImages >= MAX_IMAGES}
              onClick={() => setForm({ ...form, numImages: clampNumImages(numImages + 1) })}
              className="grid h-7 w-7 place-items-center rounded-[7px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
            >
              +
            </button>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
              max {MAX_IMAGES}
            </span>
          </div>
        </div>

        <div>
          <FieldLabel>resolution</FieldLabel>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="resolution">
            {RESOLUTIONS.map((r) => {
              const active = form.resolution === r;
              return (
                <Chip
                  key={r}
                  active={active}
                  role="button"
                  aria-pressed={active}
                  data-testid={`adhoc-res-${r}`}
                  onClick={() => setForm({ ...form, resolution: r })}
                >
                  {r}
                </Chip>
              );
            })}
          </div>
        </div>
      </div>

      {/* references — collapsible picker */}
      <div>
        <button
          type="button"
          onClick={() => setRefsExpanded(!refsExpanded)}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2 hover:text-fg-0"
          aria-expanded={refsExpanded}
          aria-controls="adhoc-refs"
          data-testid="adhoc-refs-toggle"
        >
          {refsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {refsExpanded ? '− reference images' : '+ add reference images'}
          {form.referenceAssetIds.length > 0 && (
            <span className="ml-1 rounded-pill bg-volt-soft px-1.5 text-[10px] text-volt">
              {form.referenceAssetIds.length}
            </span>
          )}
        </button>
        {refsExpanded && (
          <div id="adhoc-refs" className="mt-3" data-testid="adhoc-refs-region">
            <AssetCatalogPicker
              value={form.referenceAssetIds}
              onChange={(ids) => setForm({ ...form, referenceAssetIds: ids })}
              max={MAX_REFERENCES}
            />
          </div>
        )}
      </div>

      {/* footer actions */}
      <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
        <div
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2"
          data-testid="adhoc-estimate"
          aria-live="polite"
        >
          <span className="text-fg-3">est. cost</span>
          {promptInvalid ? (
            <span className="text-fg-3">— enter prompt to estimate</span>
          ) : previewLoading && previewEstimate === null ? (
            <span className="inline-flex items-center gap-1 text-fg-3">
              <Loader2 size={11} className="animate-spin" /> calculating
            </span>
          ) : previewError && previewEstimate === null ? (
            <span className="text-danger">unavailable</span>
          ) : previewEstimate !== null ? (
            <span className="inline-flex items-center gap-2 text-fg-0">
              <BuzzPill amount={previewEstimate} />
              {previewLoading && (
                <Loader2
                  size={11}
                  className="animate-spin text-fg-3"
                  aria-label="updating estimate"
                />
              )}
            </span>
          ) : (
            <span className="text-fg-3">—</span>
          )}
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-[10px] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger"
            data-testid="adhoc-form-error"
          >
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            cancel
          </Button>
          <Button
            variant="primary"
            disabled={promptInvalid || submitting}
            leadingIcon={
              submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} strokeWidth={1.75} />
              )
            }
            onClick={onGenerate}
            data-testid="adhoc-generate"
          >
            {submitting ? 'submitting…' : 'generate'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* polling view                                                                */
/* -------------------------------------------------------------------------- */

type PollingViewProps = {
  numImages: number;
  prompt: string;
  estimatedBuzz: number | null;
  error: string | null;
  onClose: () => void;
};

export function PollingView({
  numImages,
  prompt,
  estimatedBuzz,
  error,
  onClose,
}: PollingViewProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center" data-testid="adhoc-polling">
      <span className="grid h-14 w-14 place-items-center rounded-[14px] border border-line-volt bg-volt-soft text-volt">
        <Loader2 size={26} className="animate-spin" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-fg-0">
          generating {numImages} image{numImages === 1 ? '' : 's'}…
        </h3>
        {prompt && (
          <p className="max-w-[520px] text-[13px] text-fg-2" data-testid="adhoc-polling-prompt">
            “{prompt}”
          </p>
        )}
        {estimatedBuzz !== null && (
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3">
            ≈ {estimatedBuzz} buzz
          </span>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="max-w-[420px] rounded-[10px] border border-line bg-bg-2 px-3 py-2 text-[12.5px] text-fg-1"
          data-testid="adhoc-polling-error"
        >
          {error}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onClose}>
        close — keep cooking in the background
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* results view                                                                */
/* -------------------------------------------------------------------------- */

type ResultsViewProps = {
  results: ResultsState;
  aspectRatio: AspectRatio;
  saving: boolean;
  error: string | null;
  onToggleIndex: (idx: number) => void;
  onSaveSelected: () => void;
  onDiscard: () => void;
};

const ASPECT_RATIO_NUMBERS: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
};

export function ResultsView({
  results,
  aspectRatio,
  saving,
  error,
  onToggleIndex,
  onSaveSelected,
  onDiscard,
}: ResultsViewProps) {
  const aspect = ASPECT_RATIO_NUMBERS[aspectRatio];
  const selectedSet = new Set(results.selected);
  const hasImages = results.imageUrls.length > 0;
  const canSave = selectedSet.size > 0 && !saving;

  return (
    <div className="flex flex-col gap-5" data-testid="adhoc-results">
      {!hasImages ? (
        <div className="rounded-[12px] border border-line bg-bg-2 px-4 py-6 text-center text-[13px] text-fg-1">
          generation finished but no images came back. try again.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.imageUrls.map((url, idx) => {
            const selected = selectedSet.has(idx);
            return (
              <button
                key={`${url}-${idx}`}
                type="button"
                role="checkbox"
                aria-checked={selected}
                data-testid={`adhoc-result-${idx}`}
                onClick={() => onToggleIndex(idx)}
                className={cn(
                  'group relative overflow-hidden rounded-[12px] border bg-bg-2 text-left transition-all duration-fast ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
                  selected
                    ? 'border-line-volt shadow-bloom-volt-sm'
                    : 'border-line-subtle hover:border-line-strong',
                )}
                style={{ aspectRatio: aspect }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`generated image ${idx + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-pill border text-[11px]',
                    selected
                      ? 'border-line-volt bg-volt text-fg-on-volt'
                      : 'border-line-subtle bg-black/55 text-fg-0 backdrop-blur-md',
                  )}
                >
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[10px] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger"
          data-testid="adhoc-results-error"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
          {selectedSet.size} / {results.imageUrls.length} selected
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            discard all
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            leadingIcon={saving ? <Loader2 size={14} className="animate-spin" /> : undefined}
            onClick={onSaveSelected}
            data-testid="adhoc-save-selected"
          >
            {saving
              ? 'saving…'
              : `save selected${selectedSet.size > 0 ? ` (${selectedSet.size})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
