'use client';

import { Download, MoreVertical, Pencil, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui';
import type { CampaignTile } from '@/lib/campaigns';
import { downloadImagesAsZip } from '@/lib/downloadZip';
import { PRESETS } from '@/lib/presets';
import { useTileWorkflow } from './useTileWorkflow';

type Props = { campaignId: string; tile: CampaignTile };

export function CampaignCreativeRow({ campaignId, tile }: Props) {
  const preset = PRESETS[tile.presetId];
  const { status, imageUrls, setWorkflowId } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
  });
  const [regenerating, setRegenerating] = useState(false);
  const editHref = `/campaigns/${campaignId}/c/${tile.id}`;
  const slots = Math.max(tile.quantity ?? 1, imageUrls.length || 1);

  async function redo() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { workflowId?: string };
      if (res.ok && data.workflowId) setWorkflowId(data.workflowId);
    } finally {
      setRegenerating(false);
    }
  }

  async function downloadAll() {
    if (imageUrls.length === 0) return;
    await downloadImagesAsZip(imageUrls, `${preset.id}-variants`);
  }

  const badgeKind = status === 'done' ? 'live' : status === 'failed' ? 'archived' : 'cooking';
  const badgeText = status === 'done' ? 'ready' : status === 'failed' ? 'failed' : status;

  return (
    <section data-testid="campaign-creative-row" className="border-b border-line-subtle py-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[15px] font-semibold text-fg-0">{preset.label}</span>
        <span data-testid="row-status-badge">
          <Badge kind={badgeKind}>{badgeText}</Badge>
        </span>
        <span className="font-mono text-[11px] text-fg-3">{preset.ratio}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="row-download"
            aria-label="download all"
            disabled={imageUrls.length === 0}
            onClick={downloadAll}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Download size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="row-redo"
            aria-label="redo"
            disabled={regenerating || status === 'cooking' || status === 'queued'}
            onClick={redo}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: slots }).map((_, i) => (
          <RowImage
            key={i}
            url={imageUrls[i] ?? null}
            editHref={editHref}
            ratio={preset.width / preset.height}
            filename={`${preset.id}-${tile.id}-${i}`}
            onRegenerate={redo}
          />
        ))}
      </div>
    </section>
  );
}

function RowImage({
  url,
  editHref,
  ratio,
  filename,
  onRegenerate,
}: {
  url: string | null;
  editHref: string;
  ratio: number;
  filename: string;
  onRegenerate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape to dismiss the menu. Mirrors the `TileMenu`
  // pattern in `CreativeCard` so the campaign overlays behave consistently.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
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
        <Link href={editHref} aria-label="edit creative">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </Link>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-bg-3" data-testid="row-image-skeleton" />
      )}
      {url && (
        <div ref={menuRef} className="absolute right-1.5 top-1.5">
          <button
            type="button"
            data-testid="row-image-menu"
            aria-label="image options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-6 place-items-center rounded-[6px] bg-black/55 text-white backdrop-blur-md"
          >
            <MoreVertical size={13} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-[8px] border border-line-subtle bg-bg-1 py-1 shadow-lg"
            >
              <Link
                role="menuitem"
                href={editHref}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <Pencil size={12} strokeWidth={1.75} /> edit
              </Link>
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
                onClick={() => {
                  onRegenerate();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <RefreshCw size={12} strokeWidth={1.75} /> regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
