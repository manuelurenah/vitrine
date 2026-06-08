'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, MoreVertical, RefreshCw, Sparkles } from 'lucide-react';
import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { Badge, cn } from '@/components/ui';
import { PRESETS, type PresetId } from '@/lib/presets';
import { PostGenActions } from '@/components/generations/PostGenActions';
import { downloadImagesAsZip } from '@/lib/downloadZip';

type RegenerateContext = {
  kind?: 'campaign' | 'photoshoot';
  id: string;
  tileId: string;
};

type AdCopy = {
  headline: string;
  subhead: string;
  cta?: string;
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
  adCopy?: AdCopy | null;
  /**
   * Which surface is rendering this card. Defaults to 'campaign' for
   * back-compat. The 'photoshoot' surface unlocks the per-tile actions menu
   * and the multi-select overlay.
   */
  context?: 'campaign' | 'photoshoot';
  /** Asset id this tile resolved to once the workflow finished. */
  tileAssetId?: string | null;
  /** When true, the card renders a full-tile select overlay instead of the menu. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onUseAsProduct?: (assetId: string) => void;
  onUseInCampaign?: (assetId: string) => void;
};

type CardStatus = 'queued' | 'cooking' | 'done' | 'failed';

/**
 * Pure predicate: should the photoshoot per-tile action menu render?
 *
 * Exported so unit tests can verify the logic without standing up a full
 * React render (the component depends on `useRouter`, which is not mocked
 * in the SSR test harness).
 */
export function shouldShowTileMenu(args: {
  context?: 'campaign' | 'photoshoot';
  status: CardStatus;
  tileAssetId?: string | null;
  selectMode?: boolean;
}): boolean {
  return (
    args.context === 'photoshoot' &&
    !args.selectMode &&
    args.status === 'done' &&
    args.tileAssetId != null
  );
}

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
  adCopy,
  context = 'campaign',
  tileAssetId = null,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onUseAsProduct,
  onUseInCampaign,
}: Props) {
  const router = useRouter();
  const preset = PRESETS[presetId];
  const aspect = preset.width / preset.height;
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [status, setStatus] = useState<CardStatus>(initialStatus);
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [zipping, setZipping] = useState(false);

  async function downloadAll() {
    if (imgUrls.length === 0 || zipping) return;
    if (imgUrls.length === 1) {
      const link = document.createElement('a');
      link.href = imgUrls[0]!;
      link.download = `${preset.id}-v1`;
      link.rel = 'noopener noreferrer';
      link.click();
      return;
    }
    setZipping(true);
    try {
      await downloadImagesAsZip(imgUrls, `${preset.id}-variants`);
    } catch (err) {
      console.error('[creative-card] zip download failed', err);
    } finally {
      setZipping(false);
    }
  }

  const safeQuantity = Math.max(1, quantity);
  const isMulti = safeQuantity > 1;

  async function onRegenerate() {
    if (!regenerate) return;
    setRegenerating(true);
    setError(null);
    setImgUrls([]);
    setStatus('cooking');
    try {
      const base =
        regenerate.kind === 'photoshoot' ? '/api/photoshoot' : '/api/campaigns';
      const res = await fetch(
        `${base}/${regenerate.id}/tiles/${regenerate.tileId}/regenerate`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        return;
      }
      if (body.workflowId) setWorkflowId(body.workflowId);
      router.refresh();
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

  const showMenu = shouldShowTileMenu({
    context,
    status,
    tileAssetId,
    selectMode,
  });

  // The select-mode overlay covers the whole thumbnail and intentionally hides
  // existing per-image controls (regenerate, download, post-gen menu).
  const selectOverlay = selectMode ? (
    <button
      type="button"
      onClick={onToggleSelect}
      aria-pressed={selected}
      aria-label={selected ? 'deselect tile' : 'select tile'}
      className={cn(
        'absolute inset-0 z-card grid place-items-center rounded-[10px] transition-colors',
        selected ? 'bg-volt-soft ring-1 ring-volt' : 'bg-transparent hover:bg-bg-3/40',
      )}
    >
      {selected && <Check size={20} strokeWidth={2} className="text-volt" />}
    </button>
  ) : null;

  const tileMenu =
    showMenu && tileAssetId ? (
      <TileMenu
        assetId={tileAssetId}
        canRegenerate={Boolean(regenerate) && !regenerating && status !== 'cooking'}
        onUseAsProduct={onUseAsProduct}
        onUseInCampaign={onUseInCampaign}
        onRegenerate={onRegenerate}
      />
    ) : null;

  return (
    <article className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong">
      {/*
        Image area wrapper. Intentionally NOT `overflow-hidden` so the
        per-tile menu dropdown (rendered as a sibling below) can extend
        beyond the image bounds without being clipped. The `SingleImage`
        / `MultiImageGrid` children keep their own border-radius clipping
        for the image itself.
      */}
      <div className="relative">
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
        {tileMenu}
        {selectOverlay}
      </div>

      {adCopy && (adCopy.headline || adCopy.subhead) && (
        <div className="flex flex-col gap-1 px-1 pt-1">
          {adCopy.headline && (
            <p className="text-[13.5px] font-semibold leading-[1.25] text-fg-0">
              {adCopy.headline}
            </p>
          )}
          {adCopy.subhead && (
            <p className="text-[11.5px] leading-[1.35] text-fg-2">{adCopy.subhead}</p>
          )}
          {adCopy.cta && (
            <span className="mt-1 inline-flex w-fit items-center rounded-pill border border-line-subtle bg-bg-3 px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.1em] text-fg-1">
              {adCopy.cta}
            </span>
          )}
        </div>
      )}

      <footer className="flex items-center gap-2 px-1">
        <Badge kind={status === 'done' ? 'live' : status === 'failed' ? 'archived' : 'cooking'}>
          {status === 'done' ? 'ready' : status === 'failed' ? 'failed' : status}
        </Badge>
        <span className="font-mono text-[10.5px] text-fg-3">v1</span>
        <PresetBadge preset={preset} inline />
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
          aria-label={imgUrls.length > 1 ? 'download all as zip' : 'download'}
          disabled={status !== 'done' || imgUrls.length === 0 || zipping}
          onClick={() => downloadAll()}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          {zipping ? (
            <Sparkles size={12} strokeWidth={1.75} className="animate-pulse" />
          ) : (
            <Download size={12} strokeWidth={1.75} />
          )}
        </button>
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
}: RenderProps & {
  url: string | null;
  workflowId: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-line bg-bg-3"
      style={{ aspectRatio: aspect }}
    >
      {url ? (
        <div data-image-overlay className="absolute inset-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="open full-size image"
            className="absolute inset-0 cursor-zoom-in"
          >
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </a>
          {status === 'done' && (
            <PostGenActions workflowId={workflowId} imageIndex={0} sourceUrl={url} />
          )}
        </div>
      ) : (
        <PlaceholderGlow />
      )}

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
}: RenderProps & {
  quantity: number;
  urls: string[];
  workflowId: string;
}) {
  // 2-column grid for 2-4, horizontal scroll strip for 5+.
  const useStrip = quantity >= 5;
  const slots = Array.from({ length: quantity });

  return (
    <div className="relative">
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
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="open full-size image"
            className="absolute inset-0 cursor-zoom-in"
          >
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </a>
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

function TileMenu({
  assetId,
  canRegenerate,
  onUseAsProduct,
  onUseInCampaign,
  onRegenerate,
}: {
  assetId: string;
  canRegenerate: boolean;
  onUseAsProduct?: (assetId: string) => void;
  onUseInCampaign?: (assetId: string) => void;
  onRegenerate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAny = Boolean(onUseAsProduct || onUseInCampaign || (onRegenerate && canRegenerate));

  // Click-outside to dismiss the menu. Matches the pattern in
  // `PostGenActions` so the two photoshoot overlays behave consistently.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!hasAny) return null;
  return (
    // Top-LEFT corner: the top-right slot is owned by `PostGenActions` (the
    // upscale/animate/download overlay) and the two menus would otherwise
    // collide visually and steal each other's clicks.
    <div ref={menuRef} className="absolute left-2 top-2 z-card">
      <button
        type="button"
        aria-label="tile actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-[6px] bg-bg-0/70 text-fg-0 backdrop-blur transition-colors hover:bg-bg-2"
      >
        <MoreVertical size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-1 flex w-[180px] flex-col rounded-[10px] border border-line bg-bg-1 p-1 shadow-lg"
        >
          {onUseAsProduct && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onUseAsProduct(assetId);
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0"
            >
              use as product image
            </button>
          )}
          {onUseInCampaign && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onUseInCampaign(assetId);
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0"
            >
              use in campaign
            </button>
          )}
          {onRegenerate && (
            <button
              role="menuitem"
              type="button"
              disabled={!canRegenerate}
              onClick={() => {
                setOpen(false);
                onRegenerate();
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-1"
            >
              regenerate
            </button>
          )}
        </div>
      )}
    </div>
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
