'use client';

import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import { Button, BuzzPill, Chip, FieldLabel, Modal, Textarea } from '@/components/ui';

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

export type AdHocGenerationModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Called after a workflow is successfully submitted. The modal closes itself;
   * the caller renders a placeholder "cooking" card that polls to completion.
   */
  onSubmitted?: (workflowId: string) => void;
  /** Test-only override for default form state (handy for SSR snapshot tests). */
  initialForm?: Partial<AdHocFormState>;
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

/* -------------------------------------------------------------------------- */
/* main component                                                              */
/* -------------------------------------------------------------------------- */

export function AdHocGenerationModal(props: AdHocGenerationModalProps) {
  // Re-mount the stateful inner component every time `open` flips, so transient
  // form state resets to its initial values on each fresh open without needing
  // a state-resetting effect.
  return <AdHocGenerationModalInner key={props.open ? 'open' : 'closed'} {...props} />;
}

function AdHocGenerationModalInner({
  open,
  onClose,
  onSubmitted,
  initialForm,
}: AdHocGenerationModalProps) {
  const [form, setForm] = useState<AdHocFormState>(() => ({
    ...DEFAULT_AD_HOC_FORM,
    ...(initialForm ?? {}),
  }));
  const [refsExpanded, setRefsExpanded] = useState<boolean>(
    (initialForm?.referenceAssetIds?.length ?? 0) > 0,
  );
  const [negExpanded, setNegExpanded] = useState<boolean>(Boolean(initialForm?.negativePrompt));
  const [submitting, setSubmitting] = useState(false);
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
    form.prompt,
    form.negativePrompt,
    form.aspectRatio,
    form.numImages,
    form.resolution,
    form.referenceAssetIds,
  ]);

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
      onSubmitted?.(body.workflowId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generation failed');
    } finally {
      setSubmitting(false);
    }
  }, [form, onSubmitted, onClose]);

  /* ---- render ---------------------------------------------------------- */

  const numImages = clampNumImages(form.numImages);

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="ad-hoc generation"
      title="generate an image."
      maxWidth={760}
    >
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
  const promptRef = useRef<HTMLTextAreaElement>(null);
  // FormView mounts fresh on each modal open (see the keyed inner component),
  // so this focuses the prompt every time the modal is opened.
  useEffect(() => {
    promptRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-5" data-testid="adhoc-form">
      {/* prompt */}
      <div>
        <FieldLabel htmlFor="adhoc-prompt">prompt</FieldLabel>
        <Textarea
          ref={promptRef}
          id="adhoc-prompt"
          rows={4}
          maxLength={4000}
          required
          autoFocus
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
          negative prompt
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
          reference images
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
              assetsOnly
              includeGenerated={false}
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
