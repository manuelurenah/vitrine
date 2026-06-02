'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import { Button, FieldLabel, Input, Textarea, cn } from '@/components/ui';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 8;

type StagedStatus = 'queued' | 'uploading' | 'done' | 'failed';

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

export function AddProductForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [images, setImages] = useState<StagedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(localId: string, p: Partial<StagedImage>) {
    setImages((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...p } : s)));
  }

  async function uploadOne(s: StagedImage): Promise<string | null> {
    patch(s.localId, { status: 'uploading', progress: 0 });
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
      await putWithProgress(
        presign.putUrl,
        s.file,
        s.file.type || 'application/octet-stream',
        (p) => patch(s.localId, { progress: p }),
      );

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

  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const accepted: StagedImage[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_BYTES) {
        setError(`${file.name} exceeds ${MAX_BYTES / 1024 / 1024}MB`);
        continue;
      }
      accepted.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        progress: 0,
      });
    }
    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeImage(localId: string) {
    setImages((prev) => {
      const target = prev.find((s) => s.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.localId !== localId);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const toUpload = images.filter((s) => s.status === 'queued' || s.status === 'failed');
      const uploaded = await Promise.all(toUpload.map((s) => uploadOne(s)));
      const failed = uploaded.filter((id) => id === null).length;
      if (failed > 0 && uploaded.every((id) => id === null) && toUpload.length > 0) {
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
          tags: tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          status: 'draft',
          imageAssetIds: dedup,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push('/brand/catalog');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  const capReached = images.length >= MAX_IMAGES;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="prod-name">product name</FieldLabel>
        <Input
          id="prod-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="lumen golden serum"
          required
        />
      </div>

      <div>
        <FieldLabel htmlFor="prod-description">description</FieldLabel>
        <Textarea
          id="prod-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="15ml amber dropper · turmeric + bakuchiol · warm honey palette"
        />
      </div>

      <div>
        <FieldLabel htmlFor="prod-tags">tags</FieldLabel>
        <Input
          id="prod-tags"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="hero, serum, gift"
        />
      </div>

      <div>
        <FieldLabel htmlFor={fileInputId}>product images ({images.length}/{MAX_IMAGES})</FieldLabel>
        <input
          ref={inputRef}
          id={fileInputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {images.map((s) => (
            <div
              key={s.localId}
              className={cn(
                'relative aspect-square overflow-hidden rounded-md border border-fg-3 bg-bg-2',
                s.status === 'failed' && 'border-danger',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.previewUrl}
                alt={s.file.name}
                className="h-full w-full object-cover"
              />
              {s.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-bg-3">
                  <div
                    className="h-full bg-volt transition-all"
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              )}
              {s.status === 'failed' && (
                <span className="absolute inset-x-0 bottom-0 bg-danger/80 px-1 py-0.5 text-center font-mono text-[10px] text-bg-1">
                  {s.error}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(s.localId)}
                className="absolute right-1 top-1 rounded-full bg-bg-1/80 p-1 text-fg-1 hover:bg-bg-1"
                aria-label={`remove ${s.file.name}`}
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {!capReached && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-md border border-dashed border-fg-3 bg-bg-2 text-fg-2 hover:border-volt hover:text-volt"
            >
              <span className="flex flex-col items-center gap-1 font-mono text-[11px]">
                <ImagePlus size={18} strokeWidth={1.5} />
                add image
              </span>
            </button>
          )}
        </div>
        <p className="mt-1 font-mono text-[11px] text-fg-2">
          first image becomes the hero. max {MAX_BYTES / 1024 / 1024}MB per file.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        {error && <span className="font-mono text-[11.5px] text-danger">{error}</span>}
        <span className="flex-1" />
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || name.trim().length === 0}
          leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
        >
          {submitting ? 'saving…' : 'add to catalog'}
        </Button>
      </div>
    </form>
  );
}
