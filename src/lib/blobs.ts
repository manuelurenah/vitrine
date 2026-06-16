export type StoredBlob = { bucket: string; storageKey: string };

export type PurgeBlobsResult = { blobsDeleted: number; blobsFailed: number };

/**
 * Best-effort delete each blob via the injected `deleter`. Per-object failures
 * are swallowed and tallied — never thrown — so a flaky storage backend can't
 * strand a caller mid-deletion. Injecting the deleter keeps this a pure,
 * dependency-free helper (no db/storage/env imports), so it is unit-testable
 * in isolation.
 */
export async function purgeBlobs(
  blobs: StoredBlob[],
  deleter: (bucket: string, key: string) => Promise<void>,
): Promise<PurgeBlobsResult> {
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
