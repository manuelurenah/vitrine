'use client';

import { Trash2, Upload, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { GradientThumb } from '@/components/campaigns';
import type { CampaignSummary } from '@/lib/campaigns';

const MAX_BYTES = 20 * 1024 * 1024;

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

export type GalleryImage = {
  id: string;
  publicUrl: string | null;
  name: string;
};

type Props = {
  productId: string;
  productName: string;
  images: GalleryImage[];
  campaigns: CampaignSummary[];
};

// ---------------------------------------------------------------------------
// Main gallery + image strip
// ---------------------------------------------------------------------------
export function ProductDetailGallery({
  productId,
  productName,
  images: initialImages,
  campaigns,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [activeIdx, setActiveIdx] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hero = images[activeIdx] ?? images[0] ?? null;
  const total = images.length;

  // -------------------------------------------------------------------------
  // Per-photo delete (calls DELETE /api/assets/:id — soft-deletes the asset)
  // After deletion, removes from local state and adjusts active index.
  // NOTE: this soft-deletes the asset but does NOT update products.heroAssetId
  // if the hero is deleted. The hero field will stale until the next edit;
  // listAssetsForProduct already filters deletedAt so it disappears from the
  // strip on next load. This is acceptable for v1.
  // -------------------------------------------------------------------------
  async function deletePhoto(img: GalleryImage) {
    if (!window.confirm(`remove "${img.name}" from this product?`)) return;
    setDeletingId(img.id);
    try {
      const res = await fetch(`/api/assets/${img.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`http ${res.status}`);
      setImages((prev) => {
        const next = prev.filter((i) => i.id !== img.id);
        return next;
      });
      setActiveIdx((prev) => Math.max(0, prev > 0 ? prev - 1 : 0));
      router.refresh();
    } catch {
      alert('delete failed — please try again');
    } finally {
      setDeletingId(null);
    }
  }

  // -------------------------------------------------------------------------
  // Add photo: presign → PUT → finalize → appendProductImages
  // -------------------------------------------------------------------------
  async function uploadFile(file: File) {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError(`${file.name} is not an image`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`${file.name} exceeds 20MB`);
      return;
    }
    setUploading(true);
    try {
      // Step 1: presign
      const presignRes = await fetch('/api/assets/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          byteSize: file.size,
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

      // Step 2: PUT to storage
      await putWithProgress(
        presign.putUrl,
        file,
        file.type || 'application/octet-stream',
        () => {},
      );

      // Step 3: finalize asset record
      const finalizeRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: presign.bucket,
          key: presign.key,
          publicUrl: presign.publicUrl,
          contentType: file.type || undefined,
          byteSize: file.size,
          kind: 'upload',
          collection: 'product',
        }),
      });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `finalize http ${finalizeRes.status}`);
      }
      const { asset } = (await finalizeRes.json()) as { asset: { id: string } };

      // Step 4: append to product
      const appendRes = await fetch(`/api/catalog/products/${productId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageAssetIds: [...images.map((i) => i.id), asset.id] }),
      });
      if (!appendRes.ok) {
        const body = await appendRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `append http ${appendRes.status}`);
      }

      // Optimistically add to strip
      setImages((prev) => [
        ...prev,
        { id: asset.id, publicUrl: presign.publicUrl, name: file.name },
      ]);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Hero + strip                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        {/* Hero — 4:3 aspect ratio */}
        <div className="relative w-full aspect-[4/3] rounded-[14px] overflow-hidden border border-line-subtle bg-bg-3">
          {hero?.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.publicUrl} alt={productName} className="w-full h-full object-cover" />
          ) : (
            <GradientThumb tone="volt" className="w-full h-full" />
          )}

          {/* Position indicator overlay */}
          {total > 0 && (
            <span className="absolute bottom-2 left-2 rounded-[6px] bg-bg-0/70 px-2 py-0.5 text-[11px] font-mono text-fg-0 backdrop-blur-sm select-none">
              {activeIdx + 1} / {total}
              {activeIdx === 0 ? ' · cover' : ''}
            </span>
          )}

          {/* Edit (wand) + delete controls on the hero */}
          {hero && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              {/* Wand — v1 affordance: photo editing not yet implemented */}
              <button
                type="button"
                title="edit photo (coming soon)"
                aria-label="edit photo (coming soon)"
                className="grid size-7 place-items-center rounded-pill bg-bg-0/80 text-fg-0 transition-colors hover:bg-bg-0 cursor-not-allowed opacity-60"
                disabled
              >
                <Wand2 size={13} strokeWidth={1.75} />
              </button>
              {/* Delete photo */}
              <button
                type="button"
                title="remove this photo"
                aria-label="remove this photo"
                disabled={deletingId === hero.id}
                onClick={() => deletePhoto(hero)}
                className="grid size-7 place-items-center rounded-pill bg-bg-0/80 text-fg-0 transition-colors hover:bg-bg-0 disabled:opacity-50"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        {/* Photo strip */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              aria-label={`view photo ${idx + 1}`}
              onClick={() => setActiveIdx(idx)}
              className={`relative flex-none w-[72px] aspect-square rounded-md border overflow-hidden transition-all ${
                idx === activeIdx
                  ? 'border-fg-0 ring-1 ring-fg-0'
                  : 'border-line-subtle hover:border-line'
              }`}
            >
              {img.publicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
              ) : (
                <GradientThumb tone="volt" className="w-full h-full" />
              )}
            </button>
          ))}

          {/* Upload file button — opens file picker */}
          <button
            type="button"
            aria-label="upload photo"
            title="upload photo from device"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex-none w-[72px] aspect-square rounded-md border border-dashed border-line-subtle bg-bg-2 flex flex-col items-center justify-center gap-1 text-fg-2 hover:bg-bg-3 hover:text-fg-1 transition-colors disabled:opacity-50"
          >
            <Upload size={14} strokeWidth={1.75} />
            <span className="text-[10px] leading-none">upload</span>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden="true"
          onChange={onFileChange}
        />
        {uploading && <p className="text-[12px] text-fg-2 animate-pulse">uploading…</p>}
        {uploadError && <p className="text-[12px] text-red-400">{uploadError}</p>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Used-in-campaigns grid                                              */}
      {/* ------------------------------------------------------------------ */}
      {campaigns.length > 0 && (
        <div className="mt-2">
          <span className="t-eyebrow">// used in campaigns</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="group flex flex-col overflow-hidden rounded-[10px] border border-line-subtle bg-bg-2 transition-colors hover:bg-bg-3"
              >
                {c.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbUrl}
                    alt={c.title}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <GradientThumb tone="flux" className="aspect-video w-full" />
                )}
                <div className="px-3 py-2">
                  <p className="truncate text-[12px] font-medium text-fg-0 group-hover:text-fg-0">
                    {c.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-2">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {campaigns.length === 0 && (
        <p className="text-[12px] text-fg-2">not used in any campaigns yet</p>
      )}
    </div>
  );
}
