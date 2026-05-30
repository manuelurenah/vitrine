import 'server-only';
import { randomUUID } from 'node:crypto';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
