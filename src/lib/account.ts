import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assets, users } from '@/lib/db/schema';
import { deleteObject } from '@/lib/s3';

export type StoredBlob = { bucket: string; storageKey: string };

export type DeleteAccountResult = { blobsDeleted: number; blobsFailed: number };

/**
 * Best-effort delete each blob via the injected `deleter`. Per-object failures
 * are swallowed and tallied — never thrown — so a flaky storage backend can't
 * strand a user mid-deletion. Injecting the deleter keeps this unit-testable.
 */
export async function purgeBlobs(
  blobs: StoredBlob[],
  deleter: (bucket: string, key: string) => Promise<void>,
): Promise<DeleteAccountResult> {
  let blobsDeleted = 0;
  let blobsFailed = 0;
  for (const blob of blobs) {
    try {
      await deleter(blob.bucket, blob.storageKey);
      blobsDeleted += 1;
    } catch {
      blobsFailed += 1;
    }
  }
  return { blobsDeleted, blobsFailed };
}
