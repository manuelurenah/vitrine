import { describe, expect, it, vi } from 'vitest';
import { purgeBlobs } from './blobs';

describe('purgeBlobs', () => {
  it('deletes every blob and counts successes', async () => {
    const deleter = vi.fn().mockResolvedValue(undefined);
    const blobs = [
      { bucket: 'assets', storageKey: 'u/1.png' },
      { bucket: 'uploads', storageKey: 'u/2.png' },
    ];

    const counts = await purgeBlobs(blobs, deleter);

    expect(deleter).toHaveBeenCalledTimes(2);
    expect(deleter).toHaveBeenCalledWith('assets', 'u/1.png');
    expect(deleter).toHaveBeenCalledWith('uploads', 'u/2.png');
    expect(counts).toEqual({ blobsDeleted: 2, blobsFailed: 0 });
  });

  it('swallows per-blob failures and tallies them', async () => {
    const deleter = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('s3 down'))
      .mockResolvedValueOnce(undefined);
    const blobs = [
      { bucket: 'assets', storageKey: 'a' },
      { bucket: 'assets', storageKey: 'b' },
      { bucket: 'assets', storageKey: 'c' },
    ];

    const counts = await purgeBlobs(blobs, deleter);

    expect(deleter).toHaveBeenCalledTimes(3);
    expect(counts).toEqual({ blobsDeleted: 2, blobsFailed: 1 });
  });

  it('returns zero counts for an empty list', async () => {
    const deleter = vi.fn();
    const counts = await purgeBlobs([], deleter);
    expect(deleter).not.toHaveBeenCalled();
    expect(counts).toEqual({ blobsDeleted: 0, blobsFailed: 0 });
  });
});
