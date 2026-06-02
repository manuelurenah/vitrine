'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import type { Asset } from '@/lib/assets';

type StripItem = {
  id: string;
  publicUrl: string | null;
  contentType: string | null;
};

type Props = {
  asset: Asset;
  prevId: string | null;
  nextId: string | null;
  strip: StripItem[];
  displayName: string;
  collectionLabel: string;
  uploadedLabel: string;
  formatLabel: string;
  dimensionsLabel: string;
};

export function AssetDetailView({
  asset,
  prevId,
  nextId,
  strip,
  displayName,
  collectionLabel,
  uploadedLabel,
  formatLabel,
  dimensionsLabel,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    if (deleting) return;
    if (
      !window.confirm(
        'delete this asset? campaigns + products still reference it stay intact but lose the link.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(body.error ?? `http ${res.status}`);
        setDeleting(false);
        return;
      }
      router.push('/brand/assets');
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'delete failed');
      setDeleting(false);
    }
  }

  const tags = asset.metadata.tags ?? [];
  const description = asset.metadata.description;
  const isImage = asset.contentType?.startsWith('image/') ?? false;
  const isVideo = asset.contentType?.startsWith('video/') ?? false;

  const useInCampaignHref = useMemo(
    () => `/campaigns/new?refs=${encodeURIComponent(`asset:${asset.id}`)}`,
    [asset.id],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        router.push('/brand/assets');
      } else if (e.key === 'ArrowLeft' && prevId) {
        router.push(`/brand/assets/${prevId}`);
      } else if (e.key === 'ArrowRight' && nextId) {
        router.push(`/brand/assets/${nextId}`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, prevId, nextId]);

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-black/85 backdrop-blur-[10px]">
      {/* top bar */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-line-subtle bg-bg-0/40 px-5">
        <nav
          aria-label="breadcrumb"
          className="inline-flex items-center gap-[6px] font-mono text-[12px] text-fg-2"
        >
          <Link href="/brand/assets" className="hover:text-fg-1">
            assets
          </Link>
          <span className="text-fg-3">/</span>
          <span className="text-fg-2">{collectionLabel}</span>
          <span className="text-fg-3">/</span>
          <span className="break-all text-fg-0">{displayName}</span>
        </nav>
        <div className="ml-auto inline-flex items-center gap-[6px]">
          {asset.publicUrl && (
            <a
              href={asset.publicUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="download"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-bg-2 text-fg-1 transition-colors duration-fast ease-out hover:border-line-strong hover:bg-bg-3 hover:text-fg-0"
            >
              <Download size={15} strokeWidth={1.75} />
            </a>
          )}
          <button
            type="button"
            aria-label="delete"
            onClick={onDelete}
            disabled={deleting}
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-bg-2 text-fg-1 transition-colors duration-fast ease-out hover:border-danger hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
          <Link
            href="/brand/assets"
            aria-label="close"
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-bg-2 text-fg-1 transition-colors duration-fast ease-out hover:border-line-strong hover:bg-bg-3 hover:text-fg-0"
          >
            <X size={15} strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      {/* main split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* preview */}
        <div className="relative grid place-items-center overflow-hidden px-12 py-8">
          {prevId && (
            <Link
              href={`/brand/assets/${prevId}`}
              aria-label="previous"
              className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-black/75 text-fg-0 hover:border-line-strong hover:bg-bg-3"
            >
              <ChevronLeft size={18} strokeWidth={1.75} />
            </Link>
          )}
          <div className="grid aspect-[4/3] w-full max-w-[720px] place-items-center overflow-hidden rounded-[16px] border border-line-subtle bg-bg-1">
            {isImage && asset.publicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.publicUrl}
                alt={displayName}
                className="h-full w-full object-contain"
              />
            ) : isVideo && asset.publicUrl ? (
              <video
                src={asset.publicUrl}
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3">
                preview unavailable
              </span>
            )}
          </div>
          {nextId && (
            <Link
              href={`/brand/assets/${nextId}`}
              aria-label="next"
              className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-black/75 text-fg-0 hover:border-line-strong hover:bg-bg-3"
            >
              <ChevronRight size={18} strokeWidth={1.75} />
            </Link>
          )}
        </div>

        {/* side */}
        <aside className="flex flex-col gap-4 overflow-auto border-l border-line-subtle bg-bg-1 px-6 py-7">
          <div>
            <span className="t-eyebrow">// asset</span>
            <h3 className="mt-1 break-all font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg-0">
              {displayName}
            </h3>
          </div>

          <div className="flex flex-col">
            <KV k="type" v={asset.kind} />
            <KV k="collection" v={collectionLabel} />
            <KV k="format" v={formatLabel} />
            <KV k="dimensions" v={dimensionsLabel} />
            <KV k="uploaded" v={uploadedLabel} />
            {asset.workflowId && <KV k="workflow" v={asset.workflowId} breakAll />}
          </div>

          {description && (
            <div>
              <span className="t-eyebrow">// description</span>
              <p className="mt-[6px] text-[13px] leading-[1.55] text-fg-1">{description}</p>
            </div>
          )}

          <div>
            <span className="t-eyebrow">// tags</span>
            <div className="mt-[6px] flex flex-wrap gap-[6px]">
              {tags.length === 0 ? (
                <span className="text-[12.5px] text-fg-3">no tags</span>
              ) : (
                tags.map((t) => <Chip key={t}>{t}</Chip>)
              )}
            </div>
          </div>

          {deleteError && (
            <span className="font-mono text-[11.5px] text-danger">{deleteError}</span>
          )}

          <div className="mt-auto flex flex-col gap-2">
            <Link href={useInCampaignHref} className="w-full">
              <Button
                type="button"
                variant="primary"
                leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
                className="w-full"
              >
                use in a campaign
              </Button>
            </Link>
            {asset.publicUrl && (
              <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="w-full">
                <Button
                  type="button"
                  variant="secondary"
                  leadingIcon={<Download size={14} strokeWidth={1.75} />}
                  className="w-full"
                >
                  download
                </Button>
              </a>
            )}
          </div>
        </aside>
      </div>

      {/* strip */}
      {strip.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto border-t border-line-subtle bg-bg-1 px-5 py-3">
          {strip.map((s) => {
            const isSelected = s.id === asset.id;
            const isImg = s.contentType?.startsWith('image/') ?? false;
            return (
              <Link
                key={s.id}
                href={`/brand/assets/${s.id}`}
                aria-label={`asset ${s.id}`}
                aria-current={isSelected ? 'true' : undefined}
                className={
                  'grid h-14 w-[72px] flex-shrink-0 place-items-center overflow-hidden rounded-[6px] border transition-opacity duration-fast ease-out ' +
                  (isSelected
                    ? 'border-volt opacity-100 shadow-[0_0_0_1px_var(--volt)]'
                    : 'border-line-subtle opacity-55 hover:opacity-85')
                }
              >
                {isImg && s.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.publicUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-[10px] uppercase text-fg-3">
                    {s.contentType?.split('/')[1] ?? 'file'}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KV({ k, v, breakAll }: { k: string; v: string; breakAll?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-faint py-2 last:border-b-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-2">{k}</span>
      <span className={'text-[13px] text-fg-0' + (breakAll ? ' break-all text-right' : '')}>
        {v}
      </span>
    </div>
  );
}
