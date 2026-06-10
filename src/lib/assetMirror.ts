import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { putObject } from '@/lib/s3';

/**
 * Map a content-type value to a safe file extension. Falls back to `bin` if
 * the mime is unknown — we'd rather store with an opaque extension than
 * fabricate a misleading one.
 */
function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase().split(';')[0]!.trim();
  switch (ct) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    default:
      return 'bin';
  }
}

/** sha256 hex digest, truncated to 16 chars — used as the storage-key body. */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export type MirrorResult = {
  bucket: string;
  key: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
};

/**
 * Fetch an orchestrator-produced image (or video) URL and mirror it to our
 * S3-compatible storage. Returns the bucket / key / publicUrl / contentType /
 * byteSize the caller should persist on an `assets` row.
 *
 * Key format: `generated/${userId}/${shortHash}.${ext}`. The hash is derived
 * from `sourceUrl + timestamp + randomUUID()` so concurrent saves of the same
 * source never collide on the bucket's unique storage-key index.
 *
 * Throws on non-2xx fetch or empty body — caller decides what to do.
 */
export async function mirrorOrchestratorImage(
  sourceUrl: string,
  opts: { userId: string; bucketKind?: 'asset' | 'upload' },
): Promise<MirrorResult> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`failed_to_fetch_source: status=${response.status} url=${sourceUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);
  if (body.byteLength === 0) {
    throw new Error('empty_source_body');
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0]!.trim() || 'application/octet-stream';
  const ext = extFromContentType(contentType);
  const hash = shortHash(`${sourceUrl}:${Date.now()}:${randomUUID()}`);
  const key = `generated/${opts.userId}/${hash}.${ext}`;

  const { bucket, publicUrl } = await putObject({
    key,
    bucketKind: opts.bucketKind ?? 'asset',
    body,
    contentType,
    contentLength: body.byteLength,
  });

  return {
    bucket,
    key,
    publicUrl,
    contentType,
    byteSize: body.byteLength,
  };
}
