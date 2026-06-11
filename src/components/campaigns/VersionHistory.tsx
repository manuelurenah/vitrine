'use client';

import { ArrowLeft, GitCompare, History, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import type { PresetId } from '@/lib/presets';
import { PRESETS } from '@/lib/presets';
import {
  diffTileVersions,
  type TileFieldDiff,
  type TileVersionEntry,
  type TileVersionSnapshot,
} from '@/lib/tileVersionsDiff';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  campaignId: string;
  creativeId: string;
  presetId: PresetId;
  brandName: string | null;
  versions: TileVersionEntry[];
};

const FIELD_LABELS: Record<TileFieldDiff['field'], string> = {
  headline: 'headline',
  subhead: 'subhead',
  cta: 'cta',
  prompt: 'prompt',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function toSnapshot(entry: TileVersionEntry): TileVersionSnapshot {
  return {
    version: entry.version,
    prompt: entry.prompt,
    adCopy: entry.adCopy,
  };
}

function versionTitle(entry: TileVersionEntry): string {
  return entry.adCopy?.headline?.trim() || entry.changeNote || 'untitled';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionHistory({ campaignId, creativeId, presetId, brandName, versions }: Props) {
  const router = useRouter();
  const preset = PRESETS[presetId];
  const aspect = preset.width / preset.height;

  // versions arrive sorted ascending; the latest (highest version) is current.
  const latestVersion = versions.length > 0 ? versions[versions.length - 1]!.version : 0;

  // selected = the version shown on the canvas / diffed against its predecessor.
  const [selectedVersion, setSelectedVersion] = useState(latestVersion);
  // compare mode pins a baseline to diff the selection against.
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);

  // in-flight action tracking
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = useMemo(
    () => versions.find((v) => v.version === selectedVersion) ?? versions[versions.length - 1],
    [versions, selectedVersion],
  );

  // diff baseline: in compare mode use the pinned baseline, otherwise the
  // immediately-preceding version in the list.
  const baseline = useMemo(() => {
    if (!selected) return null;
    if (compareMode && compareVersion !== null) {
      return versions.find((v) => v.version === compareVersion) ?? null;
    }
    const idx = versions.findIndex((v) => v.version === selected.version);
    return idx > 0 ? versions[idx - 1]! : null;
  }, [versions, selected, compareMode, compareVersion]);

  const diff = useMemo(() => {
    if (!selected || !baseline) return null;
    return diffTileVersions(toSnapshot(baseline), toSnapshot(selected));
  }, [selected, baseline]);

  const canvasAdCopy = selected?.adCopy ?? null;
  const isCurrent = selected?.version === latestVersion;
  const busy = restoringVersion !== null || deletingVersion !== null;

  // ---- actions --------------------------------------------------------------

  async function handleRestore(version: number) {
    if (busy) return;
    if (
      !window.confirm(
        `restore v${version}? this writes its prompt and copy back onto the creative as a new version.`,
      )
    ) {
      return;
    }
    setRestoringVersion(version);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/tiles/${creativeId}/versions/${version}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data?.error ?? `restore failed (http ${res.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'restore failed');
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handleDelete(version: number) {
    if (busy) return;
    if (!window.confirm(`delete v${version}? this can't be undone.`)) return;
    setDeletingVersion(version);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/tiles/${creativeId}/versions/${version}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data?.error ?? `delete failed (http ${res.status})`);
        return;
      }
      if (selectedVersion === version) setSelectedVersion(latestVersion);
      if (compareVersion === version) setCompareVersion(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setDeletingVersion(null);
    }
  }

  function handleThumbClick(version: number) {
    if (compareMode) {
      // first compare click pins a baseline; selecting the same one unpins.
      setCompareVersion((prev) => (prev === version ? null : version));
      return;
    }
    setSelectedVersion(version);
  }

  // newest-first for the thumb strip
  const orderedDesc = useMemo(() => [...versions].reverse(), [versions]);

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
      {/* ---------------------------------------------------------------- */}
      {/* LEFT — pill + canvas + thumb strip                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col items-center gap-3.5">
        {/* enhanced pill */}
        <div className="flex w-full max-w-[480px] items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-3 py-1.5 text-[12.5px] text-fg-1">
          <History size={13} strokeWidth={1.75} className="text-fg-3" />
          <span>version history</span>
          <span className="ml-1 font-mono text-[11px] text-fg-2">
            {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </span>
          <button
            type="button"
            aria-pressed={compareMode}
            onClick={() => {
              setCompareMode((on) => !on);
              setCompareVersion(null);
            }}
            className={
              compareMode
                ? 'ml-auto flex items-center gap-1.5 rounded-pill border border-line-volt bg-volt-soft px-2.5 py-1 text-[11.5px] text-volt'
                : 'ml-auto flex items-center gap-1.5 rounded-pill border border-line-subtle bg-bg-3 px-2.5 py-1 text-[11.5px] text-fg-1 transition-colors hover:text-fg-0'
            }
          >
            <GitCompare size={12} strokeWidth={1.75} />
            {compareMode ? 'comparing' : 'compare'}
          </button>
        </div>

        {/* canvas */}
        <div
          className="relative w-full max-w-[480px] overflow-hidden rounded-[14px] border border-line bg-bg-3"
          style={{ aspectRatio: aspect }}
        >
          {/* historical asset rendering is not wired yet; show a tonal field. */}
          <CanvasField />

          {/* version badge — volt + bloom for current */}
          <div className="absolute left-3 top-3">
            <span
              className={
                isCurrent
                  ? 'inline-flex items-center gap-1.5 rounded-pill bg-volt px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-fg-on-volt shadow-bloom-volt'
                  : 'inline-flex items-center gap-1.5 rounded-pill bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white backdrop-blur-md'
              }
            >
              v{selected?.version ?? latestVersion}
              {isCurrent && <span className="opacity-80">· current</span>}
            </span>
          </div>

          {/* ad copy overlay */}
          {canvasAdCopy && (
            <div className="absolute inset-0 flex flex-col justify-end p-4">
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
        </div>

        {/* thumb strip */}
        <div className="flex w-full max-w-[480px] gap-2 overflow-x-auto pb-1" aria-label="versions">
          {orderedDesc.map((entry) => {
            const isSelected = entry.version === selected?.version;
            const isBaseline = compareMode && entry.version === compareVersion;
            return (
              <button
                key={entry.version}
                type="button"
                onClick={() => handleThumbClick(entry.version)}
                aria-pressed={isSelected || isBaseline}
                aria-label={`version ${entry.version}, ${versionTitle(entry)}, ${relativeTime(entry.createdAt)}`}
                className={[
                  'flex w-[112px] shrink-0 flex-col gap-1 rounded-[10px] border p-2 text-left transition-colors',
                  isSelected
                    ? 'border-line-volt bg-volt-soft'
                    : isBaseline
                      ? 'border-ion bg-ion-soft'
                      : 'border-line-subtle bg-bg-2 hover:bg-bg-3',
                ].join(' ')}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-[6px]">
                  <CanvasField />
                  <span className="absolute left-1 top-1 rounded-[4px] bg-black/55 px-1 py-[1px] font-mono text-[9px] uppercase tracking-[0.06em] text-white backdrop-blur-md">
                    v{entry.version}
                  </span>
                  {entry.version === latestVersion && (
                    <span className="absolute right-1 top-1 size-[7px] rounded-pill bg-volt shadow-[0_0_8px_var(--volt-glow)]" />
                  )}
                </div>
                <span className="truncate font-display text-[11px] font-semibold text-fg-0">
                  {versionTitle(entry)}
                </span>
                <span className="font-mono text-[9.5px] text-fg-3">
                  {relativeTime(entry.createdAt)}
                </span>
              </button>
            );
          })}
        </div>

        <Link
          href={`/campaigns/${campaignId}/c/${creativeId}`}
          className="flex items-center gap-1.5 text-[12px] text-fg-3 transition-colors hover:text-fg-1"
        >
          <ArrowLeft size={12} strokeWidth={1.75} />
          back to editor
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT — diff + actions                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="rounded-[12px] border border-line-subtle bg-bg-2 p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[13px] font-semibold text-fg-0">
              {compareMode ? 'comparison' : 'changes'}
            </span>
            <span className="font-mono text-[10px] text-fg-3">
              {baseline ? `v${baseline.version} → v${selected?.version}` : `v${selected?.version}`}
            </span>
          </div>

          {compareMode && compareVersion === null ? (
            <p className="mt-3 text-[12px] leading-[1.5] text-fg-2">
              pick a version from the strip to compare it against v{selected?.version}.
            </p>
          ) : !diff ? (
            <p className="mt-3 text-[12px] leading-[1.5] text-fg-2">
              this is the first version — nothing to compare against yet.
            </p>
          ) : (
            <dl className="mt-3 flex flex-col gap-2.5">
              {diff.map((d) => (
                <div key={d.field} className="flex flex-col gap-1">
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-fg-3">
                    {FIELD_LABELS[d.field]}
                    {d.changed && (
                      <span className="rounded-[4px] bg-volt-soft px-1 py-[1px] text-[9px] text-volt">
                        changed
                      </span>
                    )}
                  </dt>
                  {d.changed ? (
                    <dd className="flex flex-col gap-1 text-[12px] leading-[1.4]">
                      <span className="rounded-[6px] bg-danger-soft px-2 py-1 text-fg-1 line-through decoration-danger/60">
                        {d.old || '—'}
                      </span>
                      <span className="rounded-[6px] bg-volt-soft px-2 py-1 text-fg-0">
                        {d.next || '—'}
                      </span>
                    </dd>
                  ) : (
                    <dd className="rounded-[6px] bg-bg-3 px-2 py-1 text-[12px] leading-[1.4] text-fg-2">
                      {d.next || '—'}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            disabled={busy || isCurrent || !selected}
            onClick={() => selected && handleRestore(selected.version)}
            aria-label={`restore version ${selected?.version}`}
            className="w-full"
            leadingIcon={
              <RotateCcw
                size={14}
                strokeWidth={1.75}
                className={restoringVersion === selected?.version ? 'animate-spin' : ''}
              />
            }
          >
            {restoringVersion === selected?.version
              ? 'restoring…'
              : isCurrent
                ? 'current version'
                : `restore v${selected?.version}`}
          </Button>

          <button
            type="button"
            disabled={busy || isCurrent || !selected || versions.length <= 1}
            onClick={() => selected && handleDelete(selected.version)}
            aria-label={`delete version ${selected?.version}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-line-subtle bg-bg-2 px-3 py-2 text-[12.5px] text-fg-1 transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-subtle disabled:hover:bg-bg-2 disabled:hover:text-fg-1"
          >
            <Trash2
              size={14}
              strokeWidth={1.75}
              className={deletingVersion === selected?.version ? 'animate-pulse' : ''}
            />
            {deletingVersion === selected?.version ? 'deleting…' : 'delete this version'}
          </button>

          {isCurrent && (
            <p className="text-[11px] leading-[1.4] text-fg-3">
              the current version can't be restored or deleted. select an older version to act on
              it.
            </p>
          )}
          {actionError && (
            <p className="text-[11.5px] text-danger" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal — tonal canvas field (historical assets not fetched in v1)
// ---------------------------------------------------------------------------

function CanvasField() {
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
