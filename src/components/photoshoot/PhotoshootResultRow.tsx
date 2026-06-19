'use client';

import { Download, MoreVertical, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTileWorkflow } from '@/components/campaigns/useTileWorkflow';
import { Spinner } from '@/components/ui';
import type { PhotoshootTile } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';

// Portaled menu geometry. The dropdown is rendered into `document.body` so it
// escapes the row's `overflow-x-auto` and the image slot's `overflow-hidden`;
// these drive its fixed-position placement under the trigger.
const MENU_WIDTH = 176;
const MENU_GAP = 8;

type Props = {
  shootId: string;
  tile: PhotoshootTile;
  ratio: string; // shoot.brief.ratio, for the thumbnail aspect box
  onUseAsProduct: (assetId: string) => void;
  onUseInCampaign: (assetId: string) => void;
};

/**
 * Convert a `'w:h'` ratio string (e.g. `'4:5'`) to a numeric aspect ratio
 * (width / height) for the thumbnail's `aspectRatio` CSS. Falls back to 1
 * (square) for malformed input.
 */
function ratioToNumber(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return 1;
  return w / h;
}

/**
 * One photoshoot tile rendered as a campaign-style row: a header (style label +
 * variant count) over a horizontal strip of variant thumbnails. Owns the live
 * workflow poll for this tile and the row-level regenerate action.
 *
 * Mirrors `CampaignCreativeRow` so the photoshoot detail page matches the
 * campaign detail page.
 */
export function PhotoshootResultRow({
  shootId,
  tile,
  ratio,
  onUseAsProduct,
  onUseInCampaign,
}: Props) {
  const template = PHOTOSHOOT_TEMPLATES[tile.templateId];
  const { imageUrls, setWorkflowId } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    imageUrls: [],
  });
  const [regenerating, setRegenerating] = useState(false);
  const aspect = ratioToNumber(ratio);

  async function redo() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/photoshoot/${shootId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { workflowId?: string };
      if (res.ok && data.workflowId) setWorkflowId(data.workflowId);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section
      data-testid="pshoot-result-row"
      className="border-b border-line-subtle py-5"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[15px] font-semibold text-fg-0">{template.label}</span>
        <span className="font-mono text-[11px] text-fg-3">
          {tile.quantity} {tile.quantity === 1 ? 'variant' : 'variants'}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: tile.quantity }).map((_, i) => (
          <RowImage
            key={i}
            url={imageUrls[i] ?? null}
            ratio={aspect}
            filename={`${tile.templateId}-${tile.id}-${i}`}
            // ASSET ID CAVEAT: only the first image of a tile has a guaranteed
            // asset id (`tile.assetId`, set by `syncAssetsFromSnapshot`).
            // Subsequent variant images share the tile's single workflow but
            // don't get individually linked asset rows, so we have no asset id
            // for them. Pass `tile.assetId` for slot 0 and `null` for the rest;
            // `RowImage` disables the "use as product" / "use in campaign"
            // actions when the asset id is null.
            assetId={i === 0 ? tile.assetId : null}
            onUseAsProduct={onUseAsProduct}
            onUseInCampaign={onUseInCampaign}
            onRegenerate={redo}
            regenerating={regenerating}
          />
        ))}
      </div>
    </section>
  );
}

function RowImage({
  url,
  ratio,
  filename,
  assetId,
  onUseAsProduct,
  onUseInCampaign,
  onRegenerate,
  regenerating,
}: {
  url: string | null;
  ratio: number;
  filename: string;
  assetId: string | null;
  onUseAsProduct: (assetId: string) => void;
  onUseInCampaign: (assetId: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerWrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuContentRef = useRef<HTMLDivElement | null>(null);

  // Two-pass mount gate so we never call createPortal during SSR.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Anchor the portaled menu under the trigger, right-aligned, clamped to the
  // viewport so it is never clipped by the row's `overflow-x-auto`.
  function positionMenu() {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const maxLeft = Math.max(MENU_GAP, window.innerWidth - MENU_WIDTH - MENU_GAP);
    const left = Math.min(Math.max(MENU_GAP, r.right - MENU_WIDTH), maxLeft);
    setMenuPos({ top: r.bottom + 4, left });
  }

  // Keep the portaled menu anchored on scroll/resize while it is open.
  useEffect(() => {
    if (!mounted || !menuOpen) return;
    positionMenu();
    const onReflow = () => positionMenu();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, menuOpen]);

  // Click-outside + Escape to dismiss. The menu is portaled out of the trigger
  // wrapper, so treat clicks inside the portaled content as "inside" too.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerWrapRef.current?.contains(t)) return;
      if (menuContentRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function downloadOne() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    a.click();
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-line bg-bg-3"
      style={{ width: 150, aspectRatio: ratio }}
    >
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="open full-size image">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </a>
      ) : (
        // Cooking placeholder: a shimmer between two surface tones (visible
        // against the bg-3 container) plus a spinning loader in the cooking
        // accent, so each in-flight variant reads as actively rendering.
        <div
          className="absolute inset-0 grid place-items-center bg-bg-2"
          data-testid="row-image-skeleton"
        >
          <div aria-hidden className="absolute inset-0 animate-pulse bg-bg-3" />
          <Spinner size={16} className="relative text-volt" label="cooking" />
        </div>
      )}
      {url && (
        <div ref={triggerWrapRef} className="absolute right-1.5 top-1.5">
          <button
            ref={triggerRef}
            type="button"
            data-testid="row-image-menu"
            aria-label="image options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              if (!menuOpen) positionMenu();
              setMenuOpen((v) => !v);
            }}
            className="grid size-6 place-items-center rounded-[6px] bg-black/55 text-white backdrop-blur-md"
          >
            <MoreVertical size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}
      {/*
        Portal the open menu into document.body with fixed positioning so it is
        never clipped by the row's `overflow-x-auto` or the image slot's
        `overflow-hidden`. Mirrors the PostGenActions menu pattern.
      */}
      {mounted &&
        menuOpen &&
        menuPos &&
        url &&
        createPortal(
          <div
            ref={menuContentRef}
            role="menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
            className="z-overlay overflow-hidden rounded-[8px] border border-line-subtle bg-bg-1 py-1 shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                downloadOne();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2"
            >
              <Download size={12} strokeWidth={1.75} /> download
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={!assetId}
              onClick={() => {
                if (assetId) onUseAsProduct(assetId);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              use as product image
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={!assetId}
              onClick={() => {
                if (assetId) onUseInCampaign(assetId);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              use in campaign
            </button>
            {/*
              No "edit" item: photoshoot has no per-image editor route (unlike
              campaigns, which link to `/campaigns/[id]/c/[creativeId]`). Omit
              rather than link to a route that doesn't exist.
            */}
            <button
              role="menuitem"
              type="button"
              disabled={regenerating}
              onClick={() => {
                onRegenerate();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2 disabled:opacity-40"
            >
              <RefreshCw
                size={12}
                strokeWidth={1.75}
                className={regenerating ? 'animate-spin' : ''}
              />{' '}
              regenerate
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
