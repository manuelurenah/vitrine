'use client';

import { useState } from 'react';
import type { LogoUploadStatus } from './LogoPreview';

export type UseLogoUpload = {
  status: LogoUploadStatus;
  upload: (file: File) => Promise<{ publicUrl: string; name: string } | null>;
};

export function useLogoUpload(): UseLogoUpload {
  const [status, setStatus] = useState<LogoUploadStatus>({ kind: 'idle' });

  async function upload(file: File): Promise<{ publicUrl: string; name: string } | null> {
    if (!file.type.startsWith('image/')) {
      setStatus({ kind: 'error', message: 'pick an image file' });
      return null;
    }
    setStatus({ kind: 'uploading' });
    try {
      const presignRes = await fetch('/api/assets/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          byteSize: file.size,
          // 'asset' bucket has public-read enabled by the dev-compose init
          // (mc anonymous set download). 'upload' bucket is private and
          // would 403 on the subsequent GET when we render the thumbnail.
          bucketKind: 'asset',
        }),
      });
      if (!presignRes.ok) {
        const body = (await presignRes.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(body.detail ?? body.error ?? `presign http ${presignRes.status}`);
      }
      const presign = (await presignRes.json()) as {
        bucket: string;
        key: string;
        putUrl: string;
        publicUrl: string;
      };
      const putRes = await fetch(presign.putUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`upload http ${putRes.status}`);
      setStatus({ kind: 'idle' });
      return { publicUrl: presign.publicUrl, name: file.name };
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'upload failed',
      });
      return null;
    }
  }

  return { status, upload };
}
