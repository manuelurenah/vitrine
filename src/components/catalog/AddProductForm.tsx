'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { Button, Chip, cn, FieldLabel, Input, Textarea } from '@/components/ui';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 8;

type StagedStatus = 'queued' | 'signing' | 'uploading' | 'saving' | 'done' | 'failed';

type StagedImage = {
  localId: string;
  file: File;
  previewUrl: string;
  status: StagedStatus;
  progress: number;
  assetId?: string;
  error?: string;
};

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

export type AddProductFormProps = {
  redirectTo?: string;
};

export function AddProductForm({ redirectTo = '/brand/catalog' }: AddProductFormProps = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [images, setImages] = useState<StagedImage[]>([]);
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

  const doneCount = images.filter((s) => s.status === 'done').length;
  const capReached = images.length >= MAX_IMAGES;

  function patch(localId: string, p: Partial<StagedImage>) {
    setImages((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...p } : s)));
  }

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);
      setImages((prev) => {
        const remaining = MAX_IMAGES - prev.length;
        if (remaining <= 0) return prev;
        const next: StagedImage[] = [...prev];
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
            localId:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'queued',
            progress: 0,
          });
        }
        return next;
      });
    },
    [],
  );

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
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.localId !== localId);
    });
  }

  async function uploadOne(s: StagedImage): Promise<string | null> {
    patch(s.localId, { status: 'signing', progress: 0 });
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

      patch(s.localId, { status: 'uploading' });
      await putWithProgress(
        presign.putUrl,
        s.file,
        s.file.type || 'application/octet-stream',
        (p) => patch(s.localId, { progress: p }),
      );

      patch(s.localId, { status: 'saving', progress: 100 });
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
      patch(s.localId, { status: 'done', progress: 100, assetId: asset.id });
      return asset.id;
    } catch (err) {
      patch(s.localId, {
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
      const toUpload = images.filter((s) => s.status === 'queued' || s.status === 'failed');
      const uploaded = await Promise.all(toUpload.map((s) => uploadOne(s)));
      if (toUpload.length > 0 && uploaded.every((id) => id === null)) {
        setError('all image uploads failed — try again');
        setSubmitting(false);
        return;
      }

      const imageAssetIds = images
        .map((s) => s.assetId)
        .concat(uploaded.filter((id): id is string => Boolean(id)))
        .filter((id): id is string => Boolean(id));
      const dedup = Array.from(new Set(imageAssetIds));

      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          notes: description.trim() || undefined,
          tags,
          status: 'live',
          imageAssetIds: dedup,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div
        onClick={() => !capReached && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!capReached) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-disabled={capReached}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !capReached) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-[14px] border border-dashed bg-bg-2/60 px-6 py-10 text-center transition-colors duration-fast ease-out',
          capReached
            ? 'cursor-not-allowed border-line opacity-60'
            : 'cursor-pointer',
          !capReached && dragOver
            ? 'border-volt bg-volt-soft text-fg-0'
            : !capReached && 'border-line hover:border-line-volt hover:bg-bg-2',
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
            {capReached
              ? `max ${MAX_IMAGES} images reached`
              : 'drop product images here, or click to choose'}
          </h3>
          <p className="mt-1 text-[12.5px] text-fg-2">
            jpg · png · webp — up to 20 mb each · first image is the hero · max {MAX_IMAGES}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={capReached}
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
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {images.length > 0 && (
        <div>
          <FieldLabel>
            {images.length} of {MAX_IMAGES} staged
          </FieldLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {images.map((s, i) => (
              <ThumbCard
                key={s.localId}
                item={s}
                isHero={i === 0}
                onRemove={() => removeImage(s.localId)}
              />
            ))}
          </div>
        </div>
      )}

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
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle pt-4">
        <span className="font-mono text-[12px] text-fg-2">
          {doneCount} of {images.length} uploaded
          {error ? <span className="ml-3 text-danger">· {error}</span> : null}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => router.push(redirectTo)}
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
            {submitting ? 'saving…' : 'add to catalog'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ThumbCard({
  item,
  isHero,
  onRemove,
}: {
  item: StagedImage;
  isHero: boolean;
  onRemove: () => void;
}) {
  const showProgress = item.status === 'uploading' || item.status === 'saving';
  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-[10px] border bg-bg-2',
        item.status === 'failed' ? 'border-danger' : 'border-line-subtle',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={item.file.name}
        className="h-full w-full object-cover"
      />
      {isHero && (
        <span className="absolute left-1.5 top-1.5 rounded-pill border border-line/40 bg-black/55 px-[8px] py-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-fg-0 backdrop-blur-md">
          hero
        </span>
      )}
      {item.status === 'done' && (
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
      {item.status === 'failed' && item.error && (
        <span className="absolute inset-x-0 bottom-0 bg-danger/80 px-1 py-0.5 text-center font-mono text-[10px] text-bg-1">
          {item.error}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`remove ${item.file.name}`}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-pill border border-line/40 bg-black/55 text-fg-0 opacity-0 backdrop-blur-md transition-opacity duration-fast ease-out hover:bg-bg-3 group-hover:opacity-100 aria-[label]:focus:opacity-100"
        style={item.status === 'done' ? { right: '32px' } : undefined}
      >
        {item.status === 'failed' ? (
          <Trash2 size={11} strokeWidth={1.75} />
        ) : (
          <X size={11} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
