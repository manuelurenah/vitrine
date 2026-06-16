import 'server-only';
import { eq } from 'drizzle-orm';
import { purgeBlobs, type PurgeBlobsResult } from '@/lib/blobs';
import { db } from '@/lib/db';
import { assets, users } from '@/lib/db/schema';
import { deleteObject } from '@/lib/s3';

/**
 * Erase all vitrine data for `userKey`: first delete every object-storage blob
 * the user owns (including soft-deleted asset rows — those blobs still exist),
 * then delete the `users` row. All user-scoped tables FK to `users` with
 * ON DELETE CASCADE (second-level tables cascade from their parents or SET
 * NULL), so the single delete tears down everything. Does not touch the session
 * or the Civitai grant — the route handles those.
 */
export async function deleteAccount(userKey: string): Promise<PurgeBlobsResult> {
  const blobs = await db
    .select({ bucket: assets.bucket, storageKey: assets.storageKey })
    .from(assets)
    .where(eq(assets.userId, userKey));

  const counts = await purgeBlobs(blobs, deleteObject);

  await db.delete(users).where(eq(users.id, userKey));

  return counts;
}
