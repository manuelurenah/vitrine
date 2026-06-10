'use client';

import { ArrowDown, ArrowUp, Check, Plus, Sparkles, Star, Trash2, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { GradientThumb } from '@/components/campaigns';
import { Button, Chip, cn, FieldLabel, Input, Textarea } from '@/components/ui';
import type { Product, ProductStatus } from '@/lib/catalog';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 8;

type StagedStatus = 'queued' | 'signing' | 'uploading' | 'saving' | 'done' | 'failed';

type ImageItem =
  | {
      kind: 'existing';
      localId: string;
      assetId: string;
      publicUrl: string | null;
      label: string;
    }
  | {
      kind: 'staged';
      localId: string;
      file: File;
      previewUrl: string;
      status: StagedStatus;
      progress: number;
      assetId?: string;
      error?: string;
    };

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export type EditProductFormProps = {
  product: Product;
  initialImages: Array<{ id: string; publicUrl: string | null; name: string }>;
  redirectTo?: string;
};

export function EditProductForm({ product, initialImages, redirectTo }: EditProductFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const statusId = useId();
  const detailHref = redirectTo ?? `/brand/catalog/${product.id}`;

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.notes ?? '');
  const [tagsRaw, setTagsRaw] = useState(product.tags.join(', '));
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [images, setImages] = useState<ImageItem[]>(() =>
    initialImages.map((img) => ({
      kind: 'existing' as const,
      localId: img.id,
      assetId: img.id,
      publicUrl: img.publicUrl,
      label: img.name,
    })),
  );
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      tagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
    [tagsRaw],
  );

  const capReached = images.length >= MAX_IMAGES;

  function patchImage(localId: string, p: Partial<Extract<ImageItem, { kind: 'staged' }>>) {
    setImages((prev) =>
      prev.map((s) => (s.localId === localId && s.kind === 'staged' ? { ...s, ...p } : s)),
    );
  }

  const addFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    setImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const next: ImageItem[] = [...prev];
      for (const file of list.slice(0, remaining)) {
        if (!file.type.startsWith('image/')) {
          setError(`${file.name} is not an image`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError(`${file.name} exceeds ${MAX_BYTES / 1024 / 1024}MB`);
          continue;
        }
        next.push({
          kind: 'staged',
          localId: makeId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'queued',
          progress: 0,
        });
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

  function removeImage(localId: string) {
    setImages((prev) => {
      const target = prev.find((s) => s.localId === localId);
      if (target && target.kind === 'staged') URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.localId !== localId);
    });
  }

  function move(localId: string, dir: -1 | 1) {
    setImages((prev) => {
      const idx = prev.findIndex((s) => s.localId === localId);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  function makeHero(localId: string) {
    setImages((prev) => {
      const idx = prev.findIndex((s) => s.localId === localId);
      if (idx <= 0) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.unshift(item!);
      return next;
    });
  }

  async function uploadOne(s: Extract<ImageItem, { kind: 'staged' }>): Promise<string | null> {
    patchImage(s.localId, { status: 'signing', progress: 0 });
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

      patchImage(s.localId, { status: 'uploading' });
      await putWithProgress(
        presign.putUrl,
        s.file,
        s.file.type || 'application/octet-stream',
        (p) => patchImage(s.localId, { progress: p }),
      );

      patchImage(s.localId, { status: 'saving', progress: 100 });
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
          collection: 'product',
        }),
      });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `finalize http ${finalizeRes.status}`);
      }
      const { asset } = (await finalizeRes.json()) as { asset: { id: string } };
      patchImage(s.localId, { status: 'done', progress: 100, assetId: asset.id });
      return asset.id;
    } catch (err) {
      patchImage(s.localId, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'upload failed',
      });
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const pending = images.filter(
        (s): s is Extract<ImageItem, { kind: 'staged' }> =>
          s.kind === 'staged' && (s.status === 'queued' || s.status === 'failed') && !s.assetId,
      );
      if (pending.length > 0) {
        const results = await Promise.all(pending.map((s) => uploadOne(s)));
        if (results.every((id) => id === null)) {
          setError('all new uploads failed — try again');
          setSubmitting(false);
          return;
        }
      }

      const orderedIds = images
        .map((s) => (s.kind === 'existing' ? s.assetId : s.assetId))
        .filter((id): id is string => Boolean(id));
      const dedup = Array.from(new Set(orderedIds));

      const res = await fetch(`/api/catalog/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          notes: description.trim() || undefined,
          tags,
          status,
          imageAssetIds: dedup,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push(detailHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <div className="flex items-end justify-between">
          <FieldLabel>
            images · {images.length} of {MAX_IMAGES}
            <span className="ml-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
              first = hero
            </span>
          </FieldLabel>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={capReached}
            onClick={() => inputRef.current?.click()}
            leadingIcon={<Upload size={13} strokeWidth={1.75} />}
          >
            add image
          </Button>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!capReached) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'mt-2 grid grid-cols-2 gap-2 rounded-[14px] border border-dashed p-2 transition-colors duration-fast ease-out sm:grid-cols-3 md:grid-cols-4',
            !capReached && dragOver ? 'border-volt bg-volt-soft' : 'border-line-subtle bg-bg-2/40',
          )}
        >
          {images.length === 0 && (
            <div className="col-span-full grid place-items-center px-6 py-10 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3">
                no images · drop here or click add image
              </span>
            </div>
          )}
          {images.map((s, i) => (
            <ImageCard
              key={s.localId}
              item={s}
              isHero={i === 0}
              isFirst={i === 0}
              isLast={i === images.length - 1}
              onRemove={() => removeImage(s.localId)}
              onUp={() => move(s.localId, -1)}
              onDown={() => move(s.localId, 1)}
              onMakeHero={() => makeHero(s.localId)}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-[14px] border border-line-subtle bg-bg-2 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
          product details
        </span>

        <div>
          <FieldLabel htmlFor={nameId}>product name</FieldLabel>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="lumen golden serum"
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor={descriptionId}>
            description <span className="text-fg-3">· optional</span>
          </FieldLabel>
          <Textarea
            id={descriptionId}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="15ml amber dropper · turmeric + bakuchiol · warm honey palette"
          />
        </div>

        <div>
          <FieldLabel htmlFor={tagsId}>
            tags <span className="text-fg-3">· optional</span>
          </FieldLabel>
          <Input
            id={tagsId}
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="hero, serum, gift"
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

        <div>
          <FieldLabel htmlFor={statusId}>status</FieldLabel>
          <select
            id={statusId}
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            className="h-10 w-full rounded-[10px] border border-line-subtle bg-bg-1 px-3 text-[13.5px] text-fg-0"
          >
            <option value="live">live</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle pt-4">
        <span className="font-mono text-[12px] text-fg-2">
          {error ? <span className="text-danger">· {error}</span> : null}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push(detailHref)}
            disabled={submitting}
          >
            cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={submitting || name.trim().length === 0}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            {submitting ? 'saving…' : 'save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

type CardProps = {
  item: ImageItem;
  isHero: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  onMakeHero: () => void;
};

function ImageCard({
  item,
  isHero,
  isFirst,
  isLast,
  onRemove,
  onUp,
  onDown,
  onMakeHero,
}: CardProps) {
  const isStaged = item.kind === 'staged';
  const previewUrl = isStaged ? item.previewUrl : item.publicUrl;
  const failed = isStaged && item.status === 'failed';
  const showProgress = isStaged && (item.status === 'uploading' || item.status === 'saving');
  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-[10px] border bg-bg-2',
        failed ? 'border-danger' : 'border-line-subtle',
      )}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={isStaged ? item.file.name : item.label}
          className="h-full w-full object-cover"
        />
      ) : (
        <GradientThumb tone="volt" className="h-full w-full" />
      )}
      {isHero && (
        <span className="absolute left-1.5 top-1.5 rounded-pill border border-line/40 bg-black/55 px-[8px] py-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-fg-0 backdrop-blur-md">
          hero
        </span>
      )}
      {isStaged && item.status === 'done' && (
        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-pill border border-line-volt bg-black/55 text-volt backdrop-blur-md">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {showProgress && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-bg-3">
          <div
            className="h-full bg-volt transition-[width] duration-fast ease-out"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
      {failed && item.error && (
        <span className="absolute inset-x-0 bottom-0 bg-danger/80 px-1 py-0.5 text-center font-mono text-[10px] text-bg-1">
          {item.error}
        </span>
      )}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition-opacity duration-fast ease-out group-hover:opacity-100 focus-within:opacity-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUp}
            aria-label="move up"
            disabled={isFirst}
            className="grid h-6 w-6 place-items-center rounded-pill border border-line/40 bg-black/65 text-fg-0 backdrop-blur-md hover:bg-bg-3 disabled:opacity-40"
          >
            <ArrowUp size={11} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDown}
            aria-label="move down"
            disabled={isLast}
            className="grid h-6 w-6 place-items-center rounded-pill border border-line/40 bg-black/65 text-fg-0 backdrop-blur-md hover:bg-bg-3 disabled:opacity-40"
          >
            <ArrowDown size={11} strokeWidth={1.75} />
          </button>
          {!isHero && (
            <button
              type="button"
              onClick={onMakeHero}
              aria-label="make hero"
              className="grid h-6 w-6 place-items-center rounded-pill border border-line/40 bg-black/65 text-fg-0 backdrop-blur-md hover:bg-bg-3"
            >
              <Star size={11} strokeWidth={1.75} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove"
          className="grid h-6 w-6 place-items-center rounded-pill border border-line/40 bg-black/65 text-fg-0 backdrop-blur-md hover:border-danger hover:text-danger"
        >
          {failed ? <Trash2 size={11} strokeWidth={1.75} /> : <X size={11} strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}
