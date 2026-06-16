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

/**
 * Erase all vitrine data for `userKey`: first delete every object-storage blob
 * the user owns (including soft-deleted asset rows — those blobs still exist),
 * then delete the `users` row. All user-scoped tables FK to `users` with
 * ON DELETE CASCADE (second-level tables cascade from their parents or SET
 * NULL), so the single delete tears down everything. Does not touch the session
 * or the Civitai grant — the route handles those.
 */
export async function deleteAccount(userKey: string): Promise<DeleteAccountResult> {
  const blobs = await db
    .select({ bucket: assets.bucket, storageKey: assets.storageKey })
    .from(assets)
    .where(eq(assets.userId, userKey));

  const counts = await purgeBlobs(blobs, deleteObject);

  await db.delete(users).where(eq(users.id, userKey));

  return counts;
}
