import { beforeEach, describe, expect, it, vi } from 'vitest';

type AssetRow = {
  id: string;
  bucket: string;
  storageKey: string;
  publicUrl: string | null;
};

// In-memory rows that the mocked drizzle query "returns". Tests mutate this.
const fakeRows: AssetRow[] = [];

// Mock drizzle: the `.select(...).from(...).where(...)` chain ultimately
// resolves to fakeRows filtered by the inArray() ids captured by `where`.
const capturedIds: string[][] = [];
vi.mock('@/lib/db', () => {
  function buildQuery() {
    let ids: string[] = [];
    const thenable = {
      from() {
        return thenable;
      },
      where(predicate: { __ids?: string[] }) {
        // Our mocked `inArray` produces { __ids: string[] }. `and(...)` returns the
        // same object so the ids survive.
        ids = predicate?.__ids ?? [];
        capturedIds.push(ids);
        return thenable;
      },
      orderBy() {
        return thenable;
      },
      limit() {
        return thenable;
      },
      innerJoin() {
        return thenable;
      },
      then(onResolve: (v: AssetRow[]) => unknown) {
        const filtered = fakeRows.filter((r) => ids.includes(r.id));
        return Promise.resolve(filtered).then(onResolve);
      },
    };
    return thenable;
  }
  return {
    db: {
      select: () => buildQuery(),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    },
  };
});

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => Object.assign({}, ...args.filter(Boolean)),
  desc: () => undefined,
  eq: () => undefined,
  isNull: () => undefined,
  inArray: (_col: unknown, ids: string[]) => ({ __ids: ids }),
}));

vi.mock('@/lib/db/schema', () => ({
  assets: {
    id: 'assets.id',
    userId: 'assets.user_id',
    bucket: 'assets.bucket',
    storageKey: 'assets.storage_key',
    publicUrl: 'assets.public_url',
    deletedAt: 'assets.deleted_at',
  },
  campaignTiles: {},
  photoshootTiles: {},
  productAssets: {},
  products: { id: 'products.id', userId: 'products.user_id', heroAssetId: 'products.hero_asset_id' },
}));

vi.mock('@/lib/env', () => ({
  env: {
    S3_BUCKET_UPLOADS: 'uploads',
    S3_BUCKET_ASSETS: 'assets',
  },
}));

const { presignGetMock, getObjectAsDataUrlMock, isLocalObjectStorageMock } = vi.hoisted(() => ({
  presignGetMock: vi.fn(async (key: string, ttl: number, bucketKind: string) => {
    return `https://presigned.test/${bucketKind}/${key}?ttl=${ttl}`;
  }),
  getObjectAsDataUrlMock: vi.fn(async ({ key, bucketKind }: { key: string; bucketKind: string }) => {
    return `data:image/png;base64,DATA_${bucketKind}_${key}`;
  }),
  isLocalObjectStorageMock: vi.fn(() => false),
}));
vi.mock('@/lib/s3', () => ({
  presignGet: presignGetMock,
  getObjectAsDataUrl: getObjectAsDataUrlMock,
  isLocalObjectStorage: isLocalObjectStorageMock,
}));

vi.mock('@/lib/civitai', () => ({
  extractImageUrls: () => [],
}));

import { getPublicUrls, MissingReferenceError } from './assets';

const USER = 'user-1';

beforeEach(() => {
  fakeRows.length = 0;
  capturedIds.length = 0;
  presignGetMock.mockClear();
  getObjectAsDataUrlMock.mockClear();
  isLocalObjectStorageMock.mockReset();
  isLocalObjectStorageMock.mockReturnValue(false);
});

describe('getPublicUrls', () => {
  it('returns publicUrl directly when present', async () => {
    fakeRows.push(
      { id: 'a1', bucket: 'assets', storageKey: 'a/1.png', publicUrl: 'https://cdn.example/a/1.png' },
      { id: 'a2', bucket: 'uploads', storageKey: 'u/2.png', publicUrl: 'https://cdn.example/u/2.png' },
    );
    const urls = await getPublicUrls(USER, ['a1', 'a2']);
    expect(urls).toEqual([
      'https://cdn.example/a/1.png',
      'https://cdn.example/u/2.png',
    ]);
    expect(presignGetMock).not.toHaveBeenCalled();
  });

  it('falls back to a presigned GET when publicUrl is null', async () => {
    fakeRows.push({ id: 'a1', bucket: 'assets', storageKey: 'a/1.png', publicUrl: null });
    const urls = await getPublicUrls(USER, ['a1']);
    expect(presignGetMock).toHaveBeenCalledTimes(1);
    const [key, ttl, bucketKind] = presignGetMock.mock.calls[0]!;
    expect(key).toBe('a/1.png');
    // Tightened default: 1h presigned TTL is enough for orchestrator pickup.
    expect(ttl).toBeLessThanOrEqual(3600);
    expect(ttl).toBeGreaterThan(60);
    expect(bucketKind).toBe('asset');
    expect(urls[0]).toContain('a/1.png');
  });

  it('picks the upload bucket kind when row.bucket matches uploads', async () => {
    fakeRows.push({ id: 'u1', bucket: 'uploads', storageKey: 'u/1.png', publicUrl: null });
    await getPublicUrls(USER, ['u1']);
    expect(presignGetMock.mock.calls[0]![2]).toBe('upload');
  });

  it('preserves input order', async () => {
    fakeRows.push(
      { id: 'a', bucket: 'assets', storageKey: 'a.png', publicUrl: 'https://cdn/a' },
      { id: 'b', bucket: 'assets', storageKey: 'b.png', publicUrl: 'https://cdn/b' },
      { id: 'c', bucket: 'assets', storageKey: 'c.png', publicUrl: 'https://cdn/c' },
    );
    const urls = await getPublicUrls(USER, ['c', 'a', 'b']);
    expect(urls).toEqual(['https://cdn/c', 'https://cdn/a', 'https://cdn/b']);
  });

  it('mixes public URLs and presigned fallbacks in one call', async () => {
    fakeRows.push(
      { id: 'pub', bucket: 'assets', storageKey: 'p.png', publicUrl: 'https://cdn/p' },
      { id: 'priv', bucket: 'assets', storageKey: 'q.png', publicUrl: null },
    );
    const urls = await getPublicUrls(USER, ['pub', 'priv']);
    expect(urls[0]).toBe('https://cdn/p');
    expect(urls[1]).toContain('q.png');
    expect(presignGetMock).toHaveBeenCalledTimes(1);
  });

  it('throws MissingReferenceError when any asset id is missing', async () => {
    fakeRows.push({ id: 'a1', bucket: 'assets', storageKey: 'a/1.png', publicUrl: 'u' });
    let caught: unknown;
    try {
      await getPublicUrls(USER, ['a1', 'missing', 'also-missing']);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MissingReferenceError);
    const e = caught as MissingReferenceError;
    expect(e.kind).toBe('assets');
    expect(e.count).toBe(2);
    // Message must NOT contain the user-supplied UUIDs (no enumeration leak).
    expect(e.message).not.toContain('missing');
    expect(e.message).not.toContain('also-missing');
  });

  it('returns [] for empty input without hitting the db', async () => {
    const urls = await getPublicUrls(USER, []);
    expect(urls).toEqual([]);
    expect(capturedIds).toHaveLength(0);
  });

  it('inlines bytes as data URLs when object storage is local (orchestrator-unreachable)', async () => {
    isLocalObjectStorageMock.mockReturnValue(true);
    fakeRows.push(
      { id: 'a1', bucket: 'assets', storageKey: 'a/1.png', publicUrl: 'http://localhost:9000/assets/a/1.png' },
      { id: 'u1', bucket: 'uploads', storageKey: 'u/2.png', publicUrl: null },
    );
    const urls = await getPublicUrls(USER, ['a1', 'u1']);
    expect(urls[0]).toBe('data:image/png;base64,DATA_asset_a/1.png');
    expect(urls[1]).toBe('data:image/png;base64,DATA_upload_u/2.png');
    expect(getObjectAsDataUrlMock).toHaveBeenCalledTimes(2);
    expect(presignGetMock).not.toHaveBeenCalled();
  });
});
