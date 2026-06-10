'use client';

import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { ArrowUpRight, Check, Download, MoreHorizontal, Wand2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';

type Action = 'upscale' | 'animate';

type ActionState = {
  estimating: boolean;
  estimatedBuzz: number | null;
  confirming: boolean;
  submitting: boolean;
  error: string | null;
};

type ChildState = {
  workflowId: string;
  estimatedBuzz: number;
  kind: Action;
  status: 'queued' | 'cooking' | 'done' | 'failed';
  imageUrl: string | null;
  videoUrl: string | null;
  error: string | null;
};

type Props = {
  workflowId: string;
  imageIndex: number;
  /** When the source media is already a video, animate is disabled. */
  isVideo?: boolean;
  className?: string;
  /** Optional download URL for the source image. */
  sourceUrl?: string | null;
};

const initialActionState: ActionState = {
  estimating: false,
  estimatedBuzz: null,
  confirming: false,
  submitting: false,
  error: null,
};

/**
 * Per-image hover overlay surfacing post-generation actions (upscale + animate)
 * plus a download shortcut. Pre-fetches buzz cost estimates on first open so the
 * user sees the cost before confirming. On confirm, submits the action via the
 * matching API route and renders an inline child card below the source image
 * that long-polls `/api/workflow/[id]` exactly like a fresh tile.
 */
export function PostGenActions({
  workflowId,
  imageIndex,
  isVideo = false,
  className,
  sourceUrl,
}: Props) {
  const router = useRouter();
  const [actions, setActions] = useState<Record<Action, ActionState>>({
    upscale: initialActionState,
    animate: initialActionState,
  });
  const [child, setChild] = useState<ChildState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const anyConfirming = actions.upscale.confirming || actions.animate.confirming;

  // Click-outside to dismiss the action menu. Confirm panels stay open via
  // `anyConfirming` regardless.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  function setAction(kind: Action, patch: Partial<ActionState>) {
    setActions((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }

  function startConfirm(kind: Action) {
    setAction(kind, { confirming: true, error: null });
  }

  function cancelConfirm(kind: Action) {
    setAction(kind, { confirming: false });
  }

  async function submitAction(kind: Action) {
    setAction(kind, { submitting: true, error: null });
    try {
      const url = `/api/generations/${workflowId}/images/${imageIndex}/${kind}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        workflowId?: string;
        estimatedBuzz?: number;
        error?: string;
      };
      if (!res.ok || !body.workflowId) {
        setAction(kind, {
          submitting: false,
          confirming: false,
          error: body.error ?? `http ${res.status}`,
        });
        return;
      }
      setAction(kind, {
        submitting: false,
        confirming: false,
        estimatedBuzz: body.estimatedBuzz ?? null,
      });
      setChild({
        workflowId: body.workflowId,
        estimatedBuzz: body.estimatedBuzz ?? 0,
        kind,
        status: 'queued',
        imageUrl: null,
        videoUrl: null,
        error: null,
      });
      router.refresh();
    } catch (err) {
      setAction(kind, {
        submitting: false,
        confirming: false,
        error: err instanceof Error ? err.message : 'submit failed',
      });
    }
  }

  return (
    <div
      data-testid="post-gen-actions"
      className={cn('pointer-events-none absolute inset-0 z-card', className)}
    >
      <div ref={menuRef} className="pointer-events-auto absolute right-2 top-2">
        <button
          type="button"
          aria-label="image actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="grid h-7 w-7 place-items-center rounded-pill border border-line/40 bg-black/65 text-fg-0 backdrop-blur-md transition-colors duration-fast ease-out hover:bg-black/80"
        >
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
        <div
          role="menu"
          aria-hidden={!menuOpen || anyConfirming}
          className={cn(
            'absolute right-0 top-9 flex w-[200px] flex-col gap-1 rounded-[10px] border border-line/40 bg-black/80 p-1 backdrop-blur-md',
            (!menuOpen || anyConfirming) && 'hidden',
          )}
        >
          <ActionChip
            label="Upscale 2×"
            icon={<ArrowUpRight size={12} strokeWidth={1.75} />}
            buzz={actions.upscale.estimatedBuzz}
            state={actions.upscale}
            onClick={() => {
              setMenuOpen(false);
              startConfirm('upscale');
            }}
            disabled={false}
          />
          <ActionChip
            label="Animate"
            icon={<Wand2 size={12} strokeWidth={1.75} />}
            buzz={actions.animate.estimatedBuzz}
            state={actions.animate}
            onClick={() => {
              setMenuOpen(false);
              startConfirm('animate');
            }}
            disabled={isVideo}
            disabledHint={isVideo ? 'already a video' : undefined}
          />
          {sourceUrl && (
            <a
              href={sourceUrl}
              download
              data-testid="post-gen-download"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-[7px] px-2 py-[6px] text-[11.5px] text-fg-0 transition-colors duration-fast ease-out hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-2">
                <Download size={12} strokeWidth={1.75} /> Download
              </span>
            </a>
          )}
        </div>
      </div>

      {/* Inline confirm panes — rendered above the chips when active. */}
      {actions.upscale.confirming && (
        <ConfirmPanel
          kind="upscale"
          label="Upscale 2×"
          buzz={actions.upscale.estimatedBuzz}
          submitting={actions.upscale.submitting}
          error={actions.upscale.error}
          onCancel={() => cancelConfirm('upscale')}
          onConfirm={() => submitAction('upscale')}
        />
      )}
      {actions.animate.confirming && (
        <ConfirmPanel
          kind="animate"
          label="Animate"
          buzz={actions.animate.estimatedBuzz}
          submitting={actions.animate.submitting}
          error={actions.animate.error}
          onCancel={() => cancelConfirm('animate')}
          onConfirm={() => submitAction('animate')}
        />
      )}

      {child && <ChildResultCard state={child} onUpdate={setChild} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* sub-components                                                              */
/* -------------------------------------------------------------------------- */

function ActionChip({
  label,
  icon,
  buzz,
  state,
  onClick,
  disabled,
  disabledHint,
}: {
  label: string;
  icon: React.ReactNode;
  buzz: number | null;
  state: ActionState;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const buzzText = buzz === null ? 'estimate…' : `${buzz} buzz`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state.submitting}
      title={disabledHint}
      data-testid={`post-gen-chip-${label.toLowerCase().replace(/\s|×/g, '-')}`}
      className={cn(
        'flex w-full items-center justify-between rounded-[7px] px-2 py-[6px] text-[11.5px] text-fg-0 transition-colors duration-fast ease-out hover:bg-white/10',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
      )}
    >
      <span className="inline-flex items-center gap-2">
        {icon} {label}
      </span>
      <span className="font-mono text-[10.5px] text-fg-2">{buzzText}</span>
    </button>
  );
}

function ConfirmPanel({
  kind,
  label,
  buzz,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  kind: Action;
  label: string;
  buzz: number | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const buzzText = buzz === null ? 'estimating…' : `~${buzz} buzz`;
  return (
    <div
      data-testid={`post-gen-confirm-${kind}`}
      className="pointer-events-auto absolute inset-x-2 top-2 z-card rounded-[10px] border border-line/40 bg-black/85 p-3 text-fg-0 backdrop-blur-md"
    >
      <div className="text-[11.5px]">
        {label} for {buzzText}?
      </div>
      {error && <div className="mt-1 text-[10.5px] text-danger">{error}</div>}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          data-testid={`post-gen-cancel-${kind}`}
          className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[11.5px] text-fg-1 hover:bg-white/10"
        >
          <X size={11} strokeWidth={1.75} /> cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          data-testid={`post-gen-confirm-${kind}-go`}
          className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-volt px-2 text-[11.5px] font-medium text-black hover:bg-volt/90 disabled:opacity-50"
        >
          <Check size={11} strokeWidth={1.75} /> {submitting ? 'submitting…' : 'confirm'}
        </button>
      </div>
    </div>
  );
}

function ChildResultCard({
  state,
  onUpdate,
}: {
  state: ChildState;
  onUpdate: (next: ChildState) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    let current = state;

    async function loop() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${current.workflowId}?wait=15000`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            current = { ...current, error: body?.error ?? `http ${res.status}` };
            onUpdate(current);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          const next = mergeChild(current, data.snapshot);
          current = next;
          onUpdate(next);
          if (data.done) return;
        } catch (err) {
          if (cancelled) return;
          current = {
            ...current,
            error: err instanceof Error ? err.message : 'poll failed',
          };
          onUpdate(current);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
    // We only want to start one polling loop per child workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workflowId]);

  const isVideo = state.kind === 'animate';

  return (
    <div
      data-testid={`post-gen-child-${state.kind}`}
      className="pointer-events-auto absolute inset-x-2 bottom-2 z-card overflow-hidden rounded-[10px] border border-line-volt bg-black/80 p-2 backdrop-blur-md"
    >
      <div className="mb-1 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.1em] text-fg-2">
        <span>
          {state.kind === 'upscale' ? '2× upscale' : 'animate'} · {state.status}
        </span>
        <span>{state.estimatedBuzz} buzz</span>
      </div>
      {state.error && <div className="text-[10.5px] text-danger">{state.error}</div>}
      {isVideo && state.videoUrl ? (
        <video
          data-testid="post-gen-video"
          controls
          src={state.videoUrl}
          className="block w-full rounded-[6px]"
        />
      ) : !isVideo && state.imageUrl ? (
        <img
          src={state.imageUrl}
          alt=""
          data-testid="post-gen-upscaled"
          className="block w-full rounded-[6px]"
        />
      ) : (
        <div
          data-testid="post-gen-child-skeleton"
          className="h-24 w-full animate-pulse rounded-[6px] bg-bg-3"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function statusFromSnap(snap: WorkflowSnapshot): ChildState['status'] {
  const s = (snap.status ?? '').toString().toLowerCase();
  if (
    s.includes('succeed') ||
    s.includes('success') ||
    s.includes('done') ||
    s.includes('complete')
  ) {
    return 'done';
  }
  if (s.includes('fail') || s.includes('error') || s.includes('cancel')) return 'failed';
  if (s.includes('pending') || s.includes('unassigned')) return 'queued';
  return 'cooking';
}

function findVideoUrl(snap: WorkflowSnapshot): string | null {
  for (const step of snap.steps ?? []) {
    const blobs = (step.output as { blobs?: Array<{ url?: string; mimeType?: string }> })?.blobs;
    if (!blobs) continue;
    for (const b of blobs) {
      if (b?.mimeType && b.mimeType.startsWith('video/') && b.url) return b.url;
    }
  }
  return null;
}

export function mergeChild(prev: ChildState, snap: WorkflowSnapshot): ChildState {
  const status = statusFromSnap(snap);
  const next: ChildState = { ...prev, status, error: null };
  if (prev.kind === 'animate') {
    const v = findVideoUrl(snap);
    if (v) next.videoUrl = v;
  } else {
    const urls = extractImageUrls(snap);
    if (urls.length > 0) next.imageUrl = urls[0] ?? null;
  }
  return next;
}
