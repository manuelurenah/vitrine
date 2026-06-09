'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Image as ImageIcon,
  Library,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button, Chip, cn, FieldLabel, Input, TabStrip, Textarea } from '@/components/ui';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import type { Asset } from '@/lib/assets';

const COLLECTIONS = ['logos', 'partners', 'past campaigns', 'references'] as const;
type Collection = (typeof COLLECTIONS)[number];

const MAX_BYTES = 20 * 1024 * 1024;

type StagedStatus = 'queued' | 'signing' | 'uploading' | 'saving' | 'done' | 'failed';

type Staged = {
  id: string;
  file: File;
  status: StagedStatus;
  progress: number;
  error?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / 1024 / 1024).toFixed(1)} mb`;
}

function fileKind(file: File): 'image' | 'video' | 'doc' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'doc';
}

function statusLabel(s: Staged): string {
  const ext = s.file.name.split('.').pop()?.toLowerCase() ?? 'file';
  const size = formatBytes(s.file.size);
  switch (s.status) {
    case 'queued':
      return `${ext} · ${size} · ready`;
    case 'signing':
      return `${ext} · ${size} · preparing`;
    case 'uploading':
      return `${ext} · ${size} · uploading`;
    case 'saving':
      return `${ext} · ${size} · saving`;
    case 'done':
      return `${ext} · ${size} · uploaded`;
    case 'failed':
      return `${ext} · ${size} · ${s.error ?? 'failed'}`;
  }
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload http ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.send(file);
  });
}

export type AssetUploaderProps = {
  redirectTo?: string;
  libraryAssets?: Asset[];
};

export function AssetUploader({
  redirectTo = '/brand/assets',
  libraryAssets,
}: AssetUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const collectionId = useId();
  const uploadPanelId = useId();
  const libraryPanelId = useId();

  const hasLibrary = (libraryAssets?.length ?? 0) > 0;

  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [collection, setCollection] = useState<Collection>('logos');
  const [tagsRaw, setTagsRaw] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upload' | 'library'>('upload');
  const [libraryPicked, setLibraryPicked] = useState<string[]>([]);
  const [promoting, setPromoting] = useState(false);

  const libraryById = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const a of libraryAssets ?? []) map.set(a.id, a);
    return map;
  }, [libraryAssets]);

  const pickedAsset =
    libraryPicked.length > 0 ? (libraryById.get(libraryPicked[0]!) ?? null) : null;
  const isAlreadyInCollection = pickedAsset?.metadata?.collection === collection;

  const tags = useMemo(
    () =>
      tagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
    [tagsRaw],
  );
  const doneCount = staged.filter((s) => s.status === 'done').length;
  const canSubmit = staged.length > 0 && staged.some((s) => s.status === 'queued') && !submitting;

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    setFormError(null);
    setStaged((prev) => {
      const next: Staged[] = [...prev];
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          next.push({
            id: crypto.randomUUID(),
            file,
            status: 'failed',
            progress: 0,
            error: 'over 20 mb',
          });
          continue;
        }
        next.push({ id: crypto.randomUUID(), file, status: 'queued', progress: 0 });
      }
      return next;
    });
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function remove(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  function patch(id: string, p: Partial<Staged>) {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  function onPickerChange(ids: string[]) {
    // Cap at 1 asset — uploader promotes a single asset at a time.
    const next = ids
      .filter((s) => s.startsWith('asset:'))
      .map((s) => s.slice('asset:'.length))
      .slice(0, 1);
    setLibraryPicked(next);
  }

  async function uploadOne(s: Staged): Promise<boolean> {
    patch(s.id, { status: 'signing', progress: 0 });
    try {
      const presignRes = await fetch('/api/assets/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: s.file.name,
          contentType: s.file.type || 'application/octet-stream',
          byteSize: s.file.size,
          bucketKind: 'asset',
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `presign http ${presignRes.status}`);
      }
      const presign = (await presignRes.json()) as {
        bucket: string;
        key: string;
        putUrl: string;
        publicUrl: string;
      };

      patch(s.id, { status: 'uploading' });
      await putWithProgress(
        presign.putUrl,
        s.file,
        s.file.type || 'application/octet-stream',
        (p) => patch(s.id, { progress: p }),
      );

      patch(s.id, { status: 'saving', progress: 100 });
      const finalizeRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: presign.bucket,
          key: presign.key,
          publicUrl: presign.publicUrl,
          contentType: s.file.type || undefined,
          byteSize: s.file.size,
          kind: 'upload',
          collection,
          tags,
          description: description || undefined,
        }),
      });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `finalize http ${finalizeRes.status}`);
      }
      patch(s.id, { status: 'done', progress: 100 });
      return true;
    } catch (err) {
      patch(s.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'upload failed',
      });
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'library') return; // library tab uses its own action button.
    setFormError(null);
    setSubmitting(true);
    const queued = staged.filter((s) => s.status === 'queued');
    if (queued.length === 0) {
      setFormError('no files queued');
      setSubmitting(false);
      return;
    }
    const results = await Promise.all(queued.map(uploadOne));
    setSubmitting(false);
    if (results.every(Boolean)) {
      router.push(redirectTo);
      router.refresh();
    } else {
      setFormError('some uploads failed — fix or remove them and retry');
    }
  }

  async function onPromote() {
    if (!pickedAsset || promoting) return;
    setFormError(null);
    setPromoting(true);
    try {
      const res = await fetch(`/api/assets/${pickedAsset.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ collection }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body?.error ?? `promote http ${res.status}`);
        setPromoting(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'promote failed');
      setPromoting(false);
    }
  }

  const pickedFilename = pickedAsset
    ? (pickedAsset.storageKey.split('/').pop() ?? pickedAsset.id)
    : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {hasLibrary && (
        <TabStrip
          value={tab}
          onChange={setTab}
          label="asset source"
          tabs={[
            {
              key: 'upload',
              label: 'upload',
              icon: <Upload size={12} strokeWidth={1.75} />,
            },
            {
              key: 'library',
              label: 'pick from library',
              icon: <Library size={12} strokeWidth={1.75} />,
            },
          ]}
          panelIds={{ upload: uploadPanelId, library: libraryPanelId }}
        />
      )}

      {(!hasLibrary || tab === 'upload') && (
        <div
          {...(hasLibrary && {
            role: 'tabpanel',
            id: uploadPanelId,
          })}
          className="flex flex-col gap-6"
        >
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-[14px] border border-dashed bg-bg-2/60 px-6 py-10 text-center transition-colors duration-fast ease-out',
              dragOver
                ? 'border-volt bg-volt-soft text-fg-0'
                : 'border-line hover:border-line-volt hover:bg-bg-2',
            )}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-[12px] border border-line-volt"
              style={{ background: 'rgba(0,255,157,0.18)' }}
            >
              <Upload size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-fg-0">
                drop files here, or click to choose
              </h3>
              <p className="mt-1 text-[12.5px] text-fg-2">
                svg · png · jpg · pdf · mp4 — up to 20 mb each
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
            >
              browse
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={onPick}
            />
          </div>

          {staged.length > 0 && (
            <div>
              <FieldLabel>{staged.length} files staged</FieldLabel>
              <div className="flex flex-col gap-2">
                {staged.map((s) => (
                  <StagedRow key={s.id} item={s} onRemove={() => remove(s.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasLibrary && tab === 'library' && (
        <div
          role="tabpanel"
          id={libraryPanelId}
          className="flex flex-col gap-4 rounded-[14px] border border-line-subtle bg-bg-2/60 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
              pick an existing asset to promote
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
              {libraryPicked.length}/1 picked
            </span>
          </div>
          <AssetCatalogPicker
            value={libraryPicked.map((id) => `asset:${id}`)}
            onChange={onPickerChange}
            max={1}
            initialTab="assets"
            includeGenerated
          />
          {pickedAsset && (
            <div className="flex items-center gap-3 rounded-[12px] border border-line-subtle bg-bg-2 px-3 py-2.5">
              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-[8px] border border-line bg-bg-3">
                {pickedAsset.contentType?.startsWith('image/') && pickedAsset.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickedAsset.publicUrl}
                    alt={pickedFilename ?? ''}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon size={16} strokeWidth={1.75} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-fg-0">
                  {isAlreadyInCollection ? (
                    <>
                      <span className="font-medium">{pickedFilename}</span> already in{' '}
                      <span className="font-medium">{collection}</span> — re-save?
                    </>
                  ) : (
                    <>
                      promoting <span className="font-medium">{pickedFilename}</span> to{' '}
                      <span className="font-medium">{collection}</span>
                    </>
                  )}
                </div>
                <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
                  from library · {pickedAsset.kind}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-[14px] border border-line-subtle bg-bg-2 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
          {tab === 'library'
            ? 'applied to picked asset'
            : staged.length > 0
              ? `applied to all ${staged.length} files`
              : 'applied to all files'}
        </span>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor={collectionId}>collection</FieldLabel>
            <div className="relative">
              <select
                id={collectionId}
                value={collection}
                onChange={(e) => setCollection(e.target.value as Collection)}
                className="h-[38px] w-full appearance-none rounded-[9px] border border-line bg-bg-2 px-3 text-[13.5px] text-fg-0 focus:border-volt focus:outline-none focus:ring-[3px] focus:ring-volt-soft"
              >
                {COLLECTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab !== 'library' && (
            <div>
              <FieldLabel htmlFor="asset-tags">tags</FieldLabel>
              <Input
                id="asset-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="primary, dark, hero"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                  <Chip>
                    <Plus size={11} /> add
                  </Chip>
                </div>
              )}
            </div>
          )}
        </div>

        {tab !== 'library' && (
          <div>
            <FieldLabel htmlFor="asset-desc">
              description <span className="text-fg-3">· optional</span>
            </FieldLabel>
            <Textarea
              id="asset-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "primary mark on dark — use on packaging + collateral."'
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle pt-4">
        <span className="font-mono text-[12px] text-fg-2">
          {tab === 'library' ? (
            <>
              {libraryPicked.length === 0 ? 'pick an asset to promote' : 'ready to promote'}
            </>
          ) : (
            <>
              {doneCount} of {staged.length} uploaded
            </>
          )}
          {formError ? <span className="ml-3 text-danger">· {formError}</span> : null}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push(redirectTo)}
            disabled={submitting || promoting}
          >
            cancel
          </Button>
          {tab === 'library' ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!pickedAsset || promoting}
              onClick={onPromote}
              leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            >
              {promoting
                ? isAlreadyInCollection
                  ? 're-tagging…'
                  : 'promoting…'
                : isAlreadyInCollection
                  ? 're-tag'
                  : 'promote to library'}
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            >
              {submitting ? 'uploading…' : 'add to library'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function StagedRow({ item, onRemove }: { item: Staged; onRemove: () => void }) {
  const kind = fileKind(item.file);
  const Icon = kind === 'video' ? Video : ImageIcon;
  const showProgress = item.status === 'uploading' || item.status === 'saving';

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line-subtle bg-bg-2 px-3 py-2">
      <div className="grid h-9 w-9 place-items-center rounded-[8px] border border-line bg-bg-3">
        <Icon size={15} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-fg-0">{item.file.name}</div>
        <div
          className={cn(
            'font-mono text-[10.5px] uppercase tracking-[0.08em]',
            item.status === 'failed' ? 'text-danger' : 'text-fg-3',
          )}
        >
          {statusLabel(item)}
        </div>
        {showProgress && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-bg-3">
            <div
              className="h-full bg-volt transition-[width] duration-fast ease-out"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>
      {item.status === 'done' ? (
        <span className="grid h-7 w-7 place-items-center rounded-pill border border-line-volt text-volt">
          <Check size={12} strokeWidth={3} />
        </span>
      ) : item.status === 'failed' ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove"
          className="grid h-7 w-7 place-items-center rounded-pill border border-danger/40 text-danger hover:bg-danger/10"
        >
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove"
          className="grid h-7 w-7 place-items-center rounded-pill border border-line text-fg-2 hover:text-fg-0"
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
