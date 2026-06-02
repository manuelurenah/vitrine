import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';

let cached: S3Client | null = null;

function getClient(): S3Client {
  if (cached) return cached;
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error('S3 not configured. Set S3_ENDPOINT + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY.');
  }
  cached = new S3Client({
    region: 'us-east-1',
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

export type PresignedUpload = {
  bucket: string;
  key: string;
  putUrl: string;
  publicUrl: string;
};

const SAFE_EXT = /^[a-z0-9]{1,10}$/i;

function safeExt(filename: string | undefined): string {
  if (!filename) return 'bin';
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return 'bin';
  const ext = filename.slice(dot + 1).toLowerCase();
  return SAFE_EXT.test(ext) ? ext : 'bin';
}

export function bucketFor(kind: 'upload' | 'asset' | 'thumb'): string {
  if (kind === 'asset') return env.S3_BUCKET_ASSETS ?? 'assets';
  return env.S3_BUCKET_UPLOADS ?? 'uploads';
}

export function publicUrlFor(bucket: string, key: string): string {
  const base = env.S3_PUBLIC_URL ?? env.S3_ENDPOINT ?? '';
  return `${base.replace(/\/$/, '')}/${bucket}/${key}`;
}

export async function presignUpload(opts: {
  userId: string;
  filename?: string;
  contentType?: string;
  bucketKind?: 'upload' | 'asset';
  expiresIn?: number;
}): Promise<PresignedUpload> {
  const bucket = bucketFor(opts.bucketKind ?? 'upload');
  const key = `${opts.userId}/${randomUUID()}.${safeExt(opts.filename)}`;
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: opts.contentType ?? 'application/octet-stream',
  });
  const putUrl = await getSignedUrl(client, command, { expiresIn: opts.expiresIn ?? 600 });
  return { bucket, key, putUrl, publicUrl: publicUrlFor(bucket, key) };
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Upload a buffer to the given bucket kind. Used for server-side mirroring of
 * orchestrator-produced images into our own storage (see {@link mirrorOrchestratorImage}).
 *
 * Returns the bucket + key + public URL so callers can persist them on the
 * `assets` row without re-deriving them.
 */
export async function putObject(opts: {
  key: string;
  bucketKind: 'upload' | 'asset';
  body: Uint8Array | Buffer;
  contentType?: string;
  contentLength?: number;
}): Promise<{ bucket: string; key: string; publicUrl: string }> {
  const bucket = bucketFor(opts.bucketKind);
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType ?? 'application/octet-stream',
      ...(opts.contentLength != null ? { ContentLength: opts.contentLength } : {}),
    }),
  );
  return { bucket, key: opts.key, publicUrl: publicUrlFor(bucket, opts.key) };
}

/**
 * Generate a presigned GET URL for an object. Used when the bucket is not
 * public-read and we need to hand a fetchable URL to the orchestrator (or
 * surface it in the UI). Default TTL is 24h.
 */
export async function presignGet(
  key: string,
  ttlSeconds = 86400,
  bucketKind: 'upload' | 'asset' = 'asset',
): Promise<string> {
  const bucket = bucketFor(bucketKind);
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: ttlSeconds });
}

/**
 * True when our configured S3 public/endpoint URL points at the local machine
 * (MinIO dev mode). Orchestrator runs off-box and cannot fetch from
 * `http://localhost`, so callers handing URLs to it must inline the bytes
 * (see {@link getObjectAsDataUrl}) when this returns true.
 */
export function isLocalObjectStorage(): boolean {
  const base = env.S3_PUBLIC_URL ?? env.S3_ENDPOINT ?? '';
  if (!base) return false;
  try {
    const host = new URL(base).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * Fetch an object's bytes via the S3 client and return a `data:<mime>;base64,...`
 * URL. Used for handing references to the orchestrator when our object storage
 * is not reachable from outside (local MinIO dev mode).
 */
export async function getObjectAsDataUrl(opts: {
  key: string;
  bucketKind: 'upload' | 'asset';
}): Promise<string> {
  const bucket = bucketFor(opts.bucketKind);
  const client = getClient();
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: opts.key }));
  if (!out.Body) throw new Error(`s3 get returned empty body for ${bucket}/${opts.key}`);
  const bytes = await out.Body.transformToByteArray();
  const contentType = out.ContentType || 'application/octet-stream';
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${contentType};base64,${base64}`;
}
