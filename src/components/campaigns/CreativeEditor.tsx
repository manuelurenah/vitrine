'use client';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  RefreshCw,
  Share2,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, FieldLabel, Input, Textarea } from '@/components/ui';
import { AD_STACK_COUNT, isStackedPreset, PRESETS, stackedAspectRatio } from '@/lib/presets';
import type { CampaignTile } from '@/lib/campaigns';
import type { TileVersionEntry } from '@/lib/tileVersions';
import { PanelRow } from './PanelRow';
import { useTileWorkflow } from './useTileWorkflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  campaignId: string;
  campaignTitle: string;
  brandName: string | null;
  brandPalette: string[];
  tile: CampaignTile;
  versions: TileVersionEntry[];
  /**
   * Which variant (image index within the tile's live workflow) the user
   * clicked to edit. Variants only exist in the live poll urls — older
   * stored versions render a single asset, so this is ignored off-latest.
   * Defaults to 0 (first variant) for back-compat.
   */
  initialVariant?: number;
};

/**
 * Pure selector for the image rendered on the canvas.
 *
 * Exported so unit tests can verify the variant/version fallback logic without
 * standing up a full React render (the component depends on `useRouter`, which
 * is not mocked in the SSR test harness). Mirrors the `shouldShowTileMenu`
 * pattern in `CreativeCard`.
 */
export function pickCanvasImageUrl(args: {
  isLatestVersion: boolean;
  liveUrls: string[];
  variantIndex: number;
  versionAssetUrl: string | null | undefined;
}): string | null {
  const { isLatestVersion, liveUrls, variantIndex, versionAssetUrl } = args;
  if (isLatestVersion) {
    // Honor the selected variant, falling back to the first image, then the
    // stored asset. Variants only populate from the live workflow snapshot.
    return liveUrls[variantIndex] ?? liveUrls[0] ?? versionAssetUrl ?? null;
  }
  // Older versions store a single rendered asset; variant index is moot.
  return versionAssetUrl ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreativeEditor({
  campaignId,
  campaignTitle,
  brandName,
  brandPalette,
  tile,
  versions,
  initialVariant = 0,
}: Props) {
  const router = useRouter();
  const preset = PRESETS[tile.presetId];
  // Stacked (wide-ad) tiles are a 3-banner sheet generated at a friendlier AR,
  // not the preset's narrow strip — preview at the real sheet ratio so the full
  // sheet shows instead of a cropped sliver.
  const stacked = isStackedPreset(tile.presetId);
  const aspect = stacked ? stackedAspectRatio(preset, AD_STACK_COUNT) : preset.width / preset.height;

  // ---- version navigation ---------------------------------------------------
  // versions are sorted asc; default to latest
  const [versionIdx, setVersionIdx] = useState(versions.length > 0 ? versions.length - 1 : 0);

  // When a new version is appended — a regenerate or save records one server-
  // side, then `router.refresh()` re-fetches `versions` — follow it to the
  // latest. Without this the index stays pinned to the old version, so
  // `isLatestVersion` goes false and the canvas keeps showing the stale
  // version's stored image instead of the freshly-generated `liveUrls`.
  // Guard on growth only so manual prev/next navigation (which doesn't change
  // the count) is preserved.
  const prevVersionCountRef = useRef(versions.length);
  useEffect(() => {
    if (versions.length > prevVersionCountRef.current) {
      setVersionIdx(versions.length - 1);
    }
    prevVersionCountRef.current = versions.length;
  }, [versions.length]);

  const currentVersion = versions[versionIdx];

  // ---- workflow polling -----------------------------------------------------
  const {
    status: pollStatus,
    imageUrls: liveUrls,
    setWorkflowId,
    setStatus,
    setImageUrls,
  } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
  });

  // The image shown on the canvas is driven by the version being viewed. The
  // latest version falls back to the live poll urls so a fresh regenerate is
  // reflected before the page re-fetches; older versions use their stored asset.
  const variantIndex = Math.max(0, Math.trunc(initialVariant));
  const isLatestVersion = versionIdx >= versions.length - 1;
  const canvasImageUrl = pickCanvasImageUrl({
    isLatestVersion,
    liveUrls,
    variantIndex,
    versionAssetUrl: currentVersion?.assetUrl ?? null,
  });

  // ---- adCopy / prompt editing state ---------------------------------------
  const [headline, setHeadline] = useState(tile.adCopy?.headline ?? '');
  const [subhead, setSubhead] = useState(tile.adCopy?.subhead ?? '');
  const [cta, setCta] = useState(tile.adCopy?.cta ?? '');
  const [promptValue, setPromptValue] = useState(tile.prompt);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Which generating action is in flight, if any. "save", "fix" (fix layout)
  // and "regen" each submit exactly one orchestrator workflow → one version.
  const [pending, setPending] = useState<null | 'save' | 'fix' | 'regen'>(null);
  const busy = pending !== null;

  // ---- palette override ----------------------------------------------------
  // Seed from the tile's persisted palette so customizations survive a reload
  // or regenerate; fall back to the brand palette when the tile has none.
  const [palette, setPalette] = useState<string[]>((tile.palette ?? brandPalette).slice(0, 6));

  // Sync panel state to the currently-viewed version (copy, prompt, palette).
  useEffect(() => {
    if (!currentVersion) return;
    setHeadline(currentVersion.adCopy?.headline ?? '');
    setSubhead(currentVersion.adCopy?.subhead ?? '');
    setCta(currentVersion.adCopy?.cta ?? '');
    setPromptValue(currentVersion.prompt);
    setPalette((currentVersion.palette ?? brandPalette).slice(0, 6));
  }, [currentVersion, brandPalette]);

  // ---- live per-generation estimate ----------------------------------------
  // Save, fix-layout, and regenerate all submit the same workflow (same
  // numImages/resolution), so one estimate covers every spending action. It's
  // surfaced once below the action bar rather than per-button.
  const [genCost, setGenCost] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/estimate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            relayout: true,
            ...(palette.length > 0 ? { palette } : {}),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { cost: number };
        if (!cancelled) setGenCost(data.cost);
      } catch {
        /* keep previous estimate */
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [campaignId, tile.id, palette]);

  const genCostLabel = genCost === null ? '…' : genCost.toLocaleString();

  // ---- generate (save / fix layout / regenerate) ---------------------------
  // All three route through the regenerate endpoint so each click renders AND
  // persists in a single version — "save" no longer stacks a metadata-only
  // version next to the rendered one.
  async function submitRegen(
    kind: 'save' | 'fix' | 'regen',
    opts: { fixLayout?: boolean; applyEdits?: boolean },
  ) {
    setPending(kind);
    setSaveError(null);
    setImageUrls([]);
    setStatus('cooking');
    try {
      const body: Record<string, unknown> = {};
      if (opts.fixLayout) {
        body.promptHint = '[fix layout: improve composition, balance, legibility]';
        // Re-layout the current creative, not the original product reference.
        body.relayout = true;
      }
      if (opts.applyEdits) {
        // The route requires both headline + subhead for ad copy; send copy only
        // when both are present so a half-filled card doesn't 400.
        if (headline && subhead) {
          body.adCopy = { headline, subhead, ...(cta ? { cta } : {}) };
        }
        if (promptValue && promptValue !== currentVersion?.prompt) {
          body.prompt = promptValue;
        }
      }
      if (palette.length > 0) body.palette = palette;
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? `http ${res.status}`);
        setStatus('done');
        return;
      }
      if (data.workflowId) setWorkflowId(data.workflowId);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'request failed');
      setStatus('done');
    } finally {
      setPending(null);
    }
  }

  // ---- download ------------------------------------------------------------
  function handleDownload() {
    if (!canvasImageUrl) return;
    const link = document.createElement('a');
    link.href = canvasImageUrl;
    link.download = `${preset.id}-${tile.id}`;
    link.rel = 'noopener noreferrer';
    link.click();
  }

  const totalVersions = versions.length;
  const displayVersionNum = totalVersions > 0 ? versionIdx + 1 : 1;
  const displayVersionTotal = totalVersions || 1;

  return (
    <div
      data-testid="creative-editor"
      className="grid grid-cols-1 gap-6 items-start md:grid-cols-[1fr_320px]"
    >
      {/* ------------------------------------------------------------------ */}
      {/* LEFT — canvas + version pill + action bar                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col items-center gap-3.5">
        {/* version pill */}
        <div
          data-testid="editor-version-pill"
          className="flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-3 py-1.5 text-[12.5px] text-fg-1"
        >
          <Link
            href={`/campaigns/${campaignId}/c/${tile.id}/history`}
            data-testid="editor-history-link"
            aria-label="open version history"
            title="version history"
            className="grid size-5 place-items-center rounded-[5px] text-fg-3 transition-colors hover:bg-bg-3 hover:text-fg-1"
          >
            <History size={13} strokeWidth={1.75} />
          </Link>
          <span>version history</span>
          <span data-testid="editor-version-label" className="ml-1 font-mono text-[11px] text-fg-2">
            {displayVersionNum} / {displayVersionTotal}
          </span>
          <button
            type="button"
            data-testid="editor-version-prev"
            aria-label="previous version"
            disabled={versionIdx <= 0}
            onClick={() => setVersionIdx((i) => Math.max(0, i - 1))}
            className="ml-1 grid size-6 place-items-center rounded-[5px] transition-colors hover:bg-bg-3 disabled:opacity-30"
          >
            <ChevronLeft size={12} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="editor-version-next"
            aria-label="next version"
            disabled={versionIdx >= totalVersions - 1}
            onClick={() => setVersionIdx((i) => Math.min(totalVersions - 1, i + 1))}
            className="grid size-6 place-items-center rounded-[5px] transition-colors hover:bg-bg-3 disabled:opacity-30"
          >
            <ChevronRight size={12} strokeWidth={1.75} />
          </button>
        </div>

        {/* canvas */}
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-[14px] border border-line bg-bg-3"
          style={{ aspectRatio: aspect }}
        >
          {/* background image */}
          {canvasImageUrl ? (
            <img
              src={canvasImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <CanvasPlaceholder />
          )}

          {/* cooking / queued overlay */}
          {pollStatus !== 'done' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg-0/60 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt">
                  <Sparkles
                    size={16}
                    strokeWidth={1.75}
                    className={
                      pollStatus === 'cooking' || pollStatus === 'queued' ? 'animate-pulse' : ''
                    }
                  />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-2">
                  {pollStatus}…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* action bar */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            data-testid="editor-fix-layout"
            disabled={busy}
            onClick={() => submitRegen('fix', { fixLayout: true })}
            aria-label="fix layout"
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            fix layout
          </Button>
          <button
            type="button"
            data-testid="editor-regenerate"
            aria-label="regenerate"
            title="regenerate · new variation"
            disabled={busy || pollStatus === 'cooking'}
            onClick={() => submitRegen('regen', {})}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={pending === 'regen' ? 'animate-spin' : ''}
            />
          </button>
          <button
            type="button"
            data-testid="editor-download"
            aria-label="download"
            title="download this image"
            disabled={!canvasImageUrl}
            onClick={handleDownload}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Download size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="editor-share"
            aria-label="share"
            disabled
            title="share · coming soon"
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Share2 size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="editor-animate"
            aria-label="animate"
            disabled
            title="animate · coming soon"
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Wand2 size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[12px] text-fg-3">
            edit fields on the right · save applies them and renders a new version.
          </p>
          <p className="flex items-center gap-1.5 text-[12px] text-fg-2" data-testid="editor-buzz-note">
            <Zap size={12} strokeWidth={1.75} className="text-volt" />
            <span>
              ~{genCostLabel} buzz per generation
              <span className="text-fg-3"> · save, fix layout & regenerate each spend buzz</span>
            </span>
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT — collapsible panels                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2.5 md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto">
        {/* image panel — read-only v1 */}
        <PanelRow label="image" defaultOpen>
          <div className="relative mt-1 h-[110px] overflow-hidden rounded-[8px] bg-bg-3">
            {canvasImageUrl ? (
              <img
                src={canvasImageUrl}
                alt=""
                className={`h-full w-full ${stacked ? 'object-contain' : 'object-cover'}`}
              />
            ) : (
              <div className="absolute inset-0 animate-pulse bg-bg-3" />
            )}
            <span className="absolute left-1.5 top-1.5 rounded-[4px] bg-black/55 px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.06em] text-white backdrop-blur-md">
              image preview
            </span>
          </div>
          {/* v1: no edit controls for image */}
          <p className="mt-2 text-[11px] text-fg-3">image editing coming soon.</p>
        </PanelRow>

        {/* header — editable */}
        <PanelRow label="header" defaultOpen>
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-headline">headline</FieldLabel>
            <Input
              id="ce-headline"
              data-testid="editor-field-header"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="precision in every drop."
              disabled={busy}
            />
          </div>
        </PanelRow>

        {/* description — editable */}
        <PanelRow label="description">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-subhead">subhead</FieldLabel>
            <Textarea
              id="ce-subhead"
              data-testid="editor-field-description"
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              placeholder="automated · zero variability"
              rows={2}
              disabled={busy}
            />
          </div>
        </PanelRow>

        {/* cta — editable */}
        <PanelRow label="call to action">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-cta">cta text</FieldLabel>
            <Input
              id="ce-cta"
              data-testid="editor-field-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="shop now"
              disabled={busy}
            />
          </div>
        </PanelRow>

        {/* palette — editable */}
        <PanelRow label="palette" testId="editor-palette-toggle">
          <div className="mt-1 flex flex-wrap gap-2">
            {palette.map((c, i) => (
              <label
                key={i}
                className="relative size-7 cursor-pointer overflow-hidden rounded-[6px] border border-line-subtle"
              >
                <span className="absolute inset-0" style={{ backgroundColor: c }} />
                <input
                  type="color"
                  aria-label={`palette color ${i + 1}`}
                  value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000'}
                  onChange={(e) => setPalette((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            ))}
            {palette.length < 6 && (
              <button
                type="button"
                data-testid="editor-palette-add"
                aria-label="add color"
                onClick={() => setPalette((p) => [...p, '#888888'])}
                className="grid size-7 place-items-center rounded-[6px] border border-dashed border-line-subtle text-fg-3 hover:text-fg-1"
              >
                +
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-fg-3">applied when you regenerate.</p>
        </PanelRow>

        {/* background / prompt — editable */}
        <PanelRow label="background">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-prompt">image prompt</FieldLabel>
            <Textarea
              id="ce-prompt"
              data-testid="editor-field-background"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder="describe the background scene…"
              rows={3}
              disabled={busy}
            />
          </div>
        </PanelRow>

        {/* save button */}
        <Button
          variant="primary"
          data-testid="editor-save"
          disabled={busy}
          onClick={() => submitRegen('save', { applyEdits: true })}
          aria-label="save changes"
          className="w-full shrink-0"
          leadingIcon={
            pending === 'save' ? (
              <Sparkles size={14} strokeWidth={1.75} className="animate-pulse" />
            ) : undefined
          }
        >
          {pending === 'save' ? 'saving…' : 'save changes'}
        </Button>
        {saveError && <p className="text-[11.5px] text-danger">{saveError}</p>}

        {/* fix layout promo card */}
        <div className="mt-1 rounded-[12px] border border-line-volt bg-volt-soft p-3.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} strokeWidth={1.75} className="text-volt" />
            <span className="font-display text-[13px] font-semibold text-fg-0">fix layout</span>
          </div>
          <p className="mt-1 text-[12px] leading-[1.4] text-fg-1">
            re-arrange the composition into a fresh layout — same product, copy, and colors.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal — canvas placeholder while cooking
// ---------------------------------------------------------------------------

function CanvasPlaceholder() {
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
