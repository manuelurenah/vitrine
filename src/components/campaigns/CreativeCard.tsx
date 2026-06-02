'use client';

import { useEffect, useState } from 'react';
import { Download, MoreHorizontal, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { Badge, cn } from '@/components/ui';
import { PRESETS, type PresetId } from '@/lib/presets';
import { PostGenActions } from '@/components/generations/PostGenActions';

type RegenerateContext = {
  campaignId: string;
  tileId: string;
};

type Props = {
  workflowId: string;
  presetId: PresetId;
  initialStatus?: 'queued' | 'cooking' | 'done' | 'failed';
  /**
   * Number of images this tile is generating. The card renders N skeletons
   * before any image lands and fills them in left-to-right as
   * `extractImageUrls(snapshot)` returns URLs.
   */
  quantity?: number;
  regenerate?: RegenerateContext;
};

type CardStatus = 'queued' | 'cooking' | 'done' | 'failed';

function statusFromSnap(snap: WorkflowSnapshot | null): CardStatus {
  const s = (snap?.status ?? '').toLowerCase();
  if (s === 'succeeded') return 'done';
  if (s === 'failed' || s === 'canceled' || s === 'expired') return 'failed';
  if (s === 'unassigned' || s === 'pending') return 'queued';
  return 'cooking';
}

function imageUrlsFromSnap(snap: WorkflowSnapshot | null): string[] {
  if (!snap) return [];
  return extractImageUrls(snap);
}

export function CreativeCard({
  workflowId: initialWorkflowId,
  presetId,
  initialStatus = 'cooking',
  quantity = 1,
  regenerate,
}: Props) {
  const preset = PRESETS[presetId];
  const aspect = preset.width / preset.height;
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [status, setStatus] = useState<CardStatus>(initialStatus);
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const safeQuantity = Math.max(1, quantity);
  const isMulti = safeQuantity > 1;

  async function onRegenerate() {
    if (!regenerate) return;
    setRegenerating(true);
    setError(null);
    setImgUrls([]);
    setStatus('cooking');
    try {
      const res = await fetch(
        `/api/campaigns/${regenerate.campaignId}/tiles/${regenerate.tileId}/regenerate`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        return;
      }
      if (body.workflowId) setWorkflowId(body.workflowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setError(body?.error ?? `http ${res.status}`);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          const next = statusFromSnap(data.snapshot);
          setStatus(next);
          const urls = imageUrlsFromSnap(data.snapshot);
          if (urls.length > 0) setImgUrls(urls);
          if (data.done) return;
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'poll failed');
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const firstUrl = imgUrls[0] ?? null;

  return (
    <article className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong">
      {isMulti ? (
        <MultiImageGrid
          quantity={safeQuantity}
          urls={imgUrls}
          aspect={aspect}
          preset={preset}
          status={status}
          error={error}
          workflowId={workflowId}
        />
      ) : (
        <SingleImage
          url={firstUrl}
          aspect={aspect}
          preset={preset}
          status={status}
          error={error}
          workflowId={workflowId}
        />
      )}

      <footer className="flex items-center gap-2 px-1">
        <Badge kind={status === 'done' ? 'live' : status === 'failed' ? 'archived' : 'cooking'}>
          {status === 'done' ? 'ready' : status === 'failed' ? 'failed' : status}
        </Badge>
        <span className="font-mono text-[10.5px] text-fg-3">v1</span>
        <span className="flex-1" />
        {regenerate && (
          <button
            type="button"
            aria-label="regenerate"
            disabled={regenerating || status === 'cooking'}
            onClick={onRegenerate}
            className="inline-flex h-7 items-center gap-[4px] rounded-[7px] px-[6px] text-[11.5px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.75}
              className={regenerating ? 'animate-spin' : ''}
            />{' '}
            redo
          </button>
        )}
        <button
          type="button"
          aria-label="animate"
          disabled={status !== 'done'}
          className="inline-flex h-7 items-center gap-[4px] rounded-[7px] px-[6px] text-[11.5px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
        >
          <Wand2 size={12} strokeWidth={1.75} /> animate
        </button>
        <a
          href={firstUrl ?? '#'}
          download
          aria-label="download"
          aria-disabled={status !== 'done'}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0',
            status !== 'done' && 'pointer-events-none opacity-40',
          )}
        >
          <Download size={12} strokeWidth={1.75} />
        </a>
      </footer>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* internal renderers                                                          */
/* -------------------------------------------------------------------------- */

type PresetForRender = (typeof PRESETS)[PresetId];

type RenderProps = {
  aspect: number;
  preset: PresetForRender;
  status: CardStatus;
  error: string | null;
};

function SingleImage({
  url,
  aspect,
  preset,
  status,
  error,
  workflowId,
}: RenderProps & { url: string | null; workflowId: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-line bg-bg-3"
      style={{ aspectRatio: aspect }}
    >
      {url ? (
        <div data-image-overlay className="absolute inset-0">
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {status === 'done' && (
            <PostGenActions workflowId={workflowId} imageIndex={0} sourceUrl={url} />
          )}
        </div>
      ) : (
        <PlaceholderGlow />
      )}

      <PresetBadge preset={preset} />
      <MoreButton />

      {status !== 'done' && <StatusOverlay status={status} error={error} />}
    </div>
  );
}

function MultiImageGrid({
  quantity,
  urls,
  aspect,
  preset,
  status,
  error,
  workflowId,
}: RenderProps & { quantity: number; urls: string[]; workflowId: string }) {
  // 2-column grid for 2-4, horizontal scroll strip for 5+.
  const useStrip = quantity >= 5;
  const slots = Array.from({ length: quantity });

  return (
    <div className="relative">
      <div className="absolute left-2 top-2 z-card flex gap-[4px]">
        <PresetBadge preset={preset} inline />
      </div>
      <div className="absolute right-2 top-2 z-card">
        <MoreButton inline />
      </div>

      {useStrip ? (
        <div className="flex gap-2 overflow-x-auto rounded-[10px] border border-line bg-bg-3 p-2">
          {slots.map((_, i) => (
            <ImageSlot
              key={i}
              url={urls[i] ?? null}
              aspect={aspect}
              className="h-32 shrink-0"
              style={{ width: `${128 * aspect}px` }}
              workflowId={workflowId}
              imageIndex={i}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-line bg-bg-3 p-2">
          {slots.map((_, i) => (
            <ImageSlot
              key={i}
              url={urls[i] ?? null}
              aspect={aspect}
              workflowId={workflowId}
              imageIndex={i}
            />
          ))}
        </div>
      )}

      {status !== 'done' && urls.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <StatusOverlay status={status} error={error} compact />
        </div>
      )}
    </div>
  );
}

function ImageSlot({
  url,
  aspect,
  className,
  style,
  workflowId,
  imageIndex,
}: {
  url: string | null;
  aspect: number;
  className?: string;
  style?: React.CSSProperties;
  workflowId: string;
  imageIndex: number;
}) {
  return (
    <div
      data-image-overlay
      className={cn(
        'group/slot relative overflow-hidden rounded-[8px] border border-line-subtle bg-bg-2',
        className,
      )}
      style={style ?? { aspectRatio: aspect }}
    >
      {url ? (
        <>
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <PostGenActions
            workflowId={workflowId}
            imageIndex={imageIndex}
            sourceUrl={url}
          />
        </>
      ) : (
        <div
          data-testid="image-skeleton"
          aria-hidden
          className="absolute inset-0 animate-pulse bg-bg-3"
        />
      )}
    </div>
  );
}

function PlaceholderGlow() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, var(--volt-soft), transparent 60%),' +
          'radial-gradient(ellipse at 80% 80%, var(--ultraviolet-soft), transparent 60%)',
      }}
    />
  );
}

function PresetBadge({ preset, inline }: { preset: PresetForRender; inline?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-pill border border-line/40 bg-black/55 px-[10px] py-[4px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-0 backdrop-blur-md',
        inline ? '' : 'absolute left-2 top-2',
      )}
    >
      {preset.label} · {preset.ratio}
    </span>
  );
}

function MoreButton({ inline }: { inline?: boolean }) {
  return (
    <button
      type="button"
      aria-label="more"
      className={cn(
        'grid h-7 w-7 place-items-center rounded-pill border border-line/40 bg-black/55 text-fg-0 backdrop-blur-md transition-colors duration-fast ease-out hover:bg-bg-3',
        inline ? '' : 'absolute right-2 top-2',
      )}
    >
      <MoreHorizontal size={14} strokeWidth={1.75} />
    </button>
  );
}

function StatusOverlay({
  status,
  error,
  compact,
}: {
  status: CardStatus;
  error: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none grid place-items-center bg-bg-0/70 backdrop-blur-[1px]',
        compact ? 'rounded-pill px-3 py-1' : 'absolute inset-0',
      )}
    >
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <div
          className={cn(
            'grid h-9 w-9 place-items-center rounded-pill border',
            status === 'failed'
              ? 'border-danger bg-danger-soft text-danger'
              : 'border-line-volt bg-volt-soft text-volt',
          )}
        >
          <Sparkles size={16} strokeWidth={1.75} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-2">
          {status}…
        </span>
        {error && <span className="text-[10.5px] text-danger">{error}</span>}
      </div>
    </div>
  );
}
