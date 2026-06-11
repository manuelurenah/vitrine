'use client';

import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  RefreshCw,
  Share2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, FieldLabel, Input, Textarea } from '@/components/ui';
import { PRESETS } from '@/lib/presets';
import type { CampaignTile } from '@/lib/campaigns';
import type { TileVersionEntry } from '@/lib/tileVersions';
import { PanelRow } from './PanelRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  campaignId: string;
  campaignTitle: string;
  brandName: string | null;
  tile: CampaignTile;
  versions: TileVersionEntry[];
};

type CardStatus = 'queued' | 'cooking' | 'done' | 'failed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreativeEditor({ campaignId, campaignTitle, brandName, tile, versions }: Props) {
  const router = useRouter();
  const preset = PRESETS[tile.presetId];
  const aspect = preset.width / preset.height;

  // ---- version navigation ---------------------------------------------------
  // versions are sorted asc; default to latest
  const [versionIdx, setVersionIdx] = useState(versions.length > 0 ? versions.length - 1 : 0);
  const currentVersion = versions[versionIdx];

  // ---- workflow polling -----------------------------------------------------
  const [workflowId, setWorkflowId] = useState(tile.workflowId);
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [pollStatus, setPollStatus] = useState<CardStatus>(tile.status);

  useEffect(() => {
    let cancelled = false;
    async function loop() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          setPollStatus(statusFromSnap(data.snapshot));
          const urls = imageUrlsFromSnap(data.snapshot);
          if (urls.length > 0) setImgUrls(urls);
          if (data.done) return;
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const firstImageUrl = imgUrls[0] ?? null;

  // ---- adCopy / prompt editing state ---------------------------------------
  const [headline, setHeadline] = useState(tile.adCopy?.headline ?? '');
  const [subhead, setSubhead] = useState(tile.adCopy?.subhead ?? '');
  const [cta, setCta] = useState(tile.adCopy?.cta ?? '');
  const [promptValue, setPromptValue] = useState(tile.prompt);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync panel state to currently-viewed version's adCopy
  useEffect(() => {
    if (!currentVersion) return;
    setHeadline(currentVersion.adCopy?.headline ?? '');
    setSubhead(currentVersion.adCopy?.subhead ?? '');
    setCta(currentVersion.adCopy?.cta ?? '');
    setPromptValue(currentVersion.prompt);
  }, [currentVersion]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      if (headline || subhead) {
        body.adCopy = { headline, subhead, ...(cta ? { cta } : {}) };
      }
      if (promptValue && promptValue !== tile.prompt) {
        body.prompt = promptValue;
      }
      if (!body.adCopy && !body.prompt) {
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `http ${res.status}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  // ---- regenerate / fix layout ---------------------------------------------
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate(fixLayout?: boolean) {
    setRegenerating(true);
    setImgUrls([]);
    setPollStatus('cooking');
    try {
      const body: Record<string, unknown> = {};
      if (fixLayout) {
        body.promptHint = '[fix layout: improve composition, balance, legibility]';
      }
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (data.workflowId) setWorkflowId(data.workflowId);
      router.refresh();
    } catch {
      // silent — status overlay shows cooking; polling will update
    } finally {
      setRegenerating(false);
    }
  }

  // ---- download ------------------------------------------------------------
  function handleDownload() {
    if (!firstImageUrl) return;
    const link = document.createElement('a');
    link.href = firstImageUrl;
    link.download = `${preset.id}-${tile.id}`;
    link.rel = 'noopener noreferrer';
    link.click();
  }

  const totalVersions = versions.length;
  const displayVersionNum = totalVersions > 0 ? versionIdx + 1 : 1;
  const displayVersionTotal = totalVersions || 1;

  // The adCopy we render on the canvas. If browsing a non-latest version, show
  // that version's stored adCopy over the live image (v1 limitation: historical
  // image assets aren't fetched separately).
  const canvasAdCopy = currentVersion?.adCopy ?? tile.adCopy;

  return (
    <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-[1fr_320px]">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT — canvas + version pill + action bar                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col items-center gap-3.5">
        {/* version pill */}
        <div className="flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-3 py-1.5 text-[12.5px] text-fg-1">
          <Link
            href={`/campaigns/${campaignId}/c/${tile.id}/history`}
            aria-label="open version history"
            title="version history"
            className="grid size-5 place-items-center rounded-[5px] text-fg-3 transition-colors hover:bg-bg-3 hover:text-fg-1"
          >
            <History size={13} strokeWidth={1.75} />
          </Link>
          <span>version history</span>
          <span className="ml-1 font-mono text-[11px] text-fg-2">
            {displayVersionNum} / {displayVersionTotal}
          </span>
          <button
            type="button"
            aria-label="previous version"
            disabled={versionIdx <= 0}
            onClick={() => setVersionIdx((i) => Math.max(0, i - 1))}
            className="ml-1 grid size-6 place-items-center rounded-[5px] transition-colors hover:bg-bg-3 disabled:opacity-30"
          >
            <ChevronLeft size={12} strokeWidth={1.75} />
          </button>
          <button
            type="button"
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
          {firstImageUrl ? (
            <img
              src={firstImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <CanvasPlaceholder />
          )}

          {/* ad copy overlay */}
          {canvasAdCopy && (
            <div className="absolute inset-0 flex flex-col justify-between p-4">
              <div>
                {(brandName ?? preset?.id) && (
                  <p
                    className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/70"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                  >
                    {brandName ?? preset.id}
                  </p>
                )}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  {canvasAdCopy.headline && (
                    <p
                      className="font-display text-[clamp(22px,4vw,36px)] font-extrabold leading-[1.0] tracking-[-0.04em] text-white"
                      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)', maxWidth: 260 }}
                    >
                      {canvasAdCopy.headline}
                    </p>
                  )}
                  {brandName && (
                    <p className="mt-3.5 font-display text-[16px] font-bold text-white/90">
                      {brandName}
                    </p>
                  )}
                </div>
                {canvasAdCopy.cta && (
                  <div
                    className="shrink-0 rounded-pill bg-volt px-[14px] py-[7px] font-display text-[12px] font-bold text-fg-on-volt"
                    style={{ boxShadow: '0 0 18px var(--volt-glow)' }}
                  >
                    {canvasAdCopy.cta}
                  </div>
                )}
              </div>
            </div>
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
            disabled={regenerating}
            onClick={() => handleRegenerate(true)}
            aria-label="fix layout"
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            fix layout
            <span className="ml-1 font-mono text-[11px] opacity-70">· 3 buzz</span>
          </Button>
          <button
            type="button"
            aria-label="regenerate"
            disabled={regenerating || pollStatus === 'cooking'}
            onClick={() => handleRegenerate(false)}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={regenerating ? 'animate-spin' : ''}
            />
          </button>
          <button
            type="button"
            aria-label="download"
            disabled={!firstImageUrl}
            onClick={handleDownload}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Download size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="share"
            disabled
            title="coming soon"
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Share2 size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="animate"
            disabled
            title="coming soon"
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Wand2 size={14} strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-[12px] text-fg-3">edit on the right · or click the canvas to inspect.</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT — collapsible panels                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2.5">
        {/* image panel — read-only v1 */}
        <PanelRow label="image" defaultOpen>
          <div className="relative mt-1 h-[110px] overflow-hidden rounded-[8px] bg-bg-3">
            {firstImageUrl ? (
              <img src={firstImageUrl} alt="" className="h-full w-full object-cover" />
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
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="precision in every drop."
              disabled={saving}
            />
          </div>
        </PanelRow>

        {/* description — editable */}
        <PanelRow label="description">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-subhead">subhead</FieldLabel>
            <Textarea
              id="ce-subhead"
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              placeholder="automated · zero variability"
              rows={2}
              disabled={saving}
            />
          </div>
        </PanelRow>

        {/* cta — editable */}
        <PanelRow label="call to action">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-cta">cta text</FieldLabel>
            <Input
              id="ce-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="shop now"
              disabled={saving}
            />
          </div>
        </PanelRow>

        {/* logo panel — read-only v1 */}
        <PanelRow label="logo">
          <div className="mt-1 flex h-12 items-center justify-center rounded-[8px] border border-dashed border-line-subtle">
            <span className="text-[11px] text-fg-3">logo editing coming soon.</span>
          </div>
        </PanelRow>

        {/* background / prompt — editable */}
        <PanelRow label="background">
          <div className="mt-1 flex flex-col gap-1.5">
            <FieldLabel htmlFor="ce-prompt">image prompt</FieldLabel>
            <Textarea
              id="ce-prompt"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder="describe the background scene…"
              rows={3}
              disabled={saving}
            />
          </div>
        </PanelRow>

        {/* save button */}
        <Button
          variant="primary"
          disabled={saving}
          onClick={handleSave}
          aria-label="save changes"
          className="w-full"
          leadingIcon={
            saving ? <Sparkles size={14} strokeWidth={1.75} className="animate-pulse" /> : undefined
          }
        >
          {saving ? 'saving…' : 'save changes'}
        </Button>
        {saveError && <p className="text-[11.5px] text-danger">{saveError}</p>}

        {/* fix layout promo card */}
        <div className="mt-1 rounded-[12px] border border-line-volt bg-volt-soft p-3.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} strokeWidth={1.75} className="text-volt" />
            <span className="font-display text-[13px] font-semibold text-fg-0">fix layout</span>
            <span className="ml-auto font-mono text-[10px] text-volt">3 buzz</span>
          </div>
          <p className="mt-1 text-[12px] leading-[1.4] text-fg-1">
            re-balance type, image, and cta without changing the content.
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
