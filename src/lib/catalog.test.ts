import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- *
 * In-memory fixtures
 * -------------------------------------------------------------------------- */

type ProductRow = {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  status: 'live' | 'draft' | 'archived';
  heroAssetId: string | null;
  usedInCount: number;
  createdAt: Date;
};

type AssetRow = { id: string; userId: string };
type ProductAssetRow = { productId: string; assetId: string; role: string; position: number };

const fixtures = {
  products: [] as ProductRow[],
  assets: [] as AssetRow[],
  productAssets: [] as ProductAssetRow[],
  /** Records all inserts into product_assets across the test. */
  productAssetInserts: [] as ProductAssetRow[],
  /** Records every `set` payload that flowed into an assets-table update. */
  assetUpdates: [] as Array<{ ids: string[]; set: Record<string, unknown> }>,
};

/* -------------------------------------------------------------------------- *
 * Symbol tags so the mocked `where` clause can read predicate intent
 * -------------------------------------------------------------------------- */

type WhereExpr = {
  __productIdEq?: string;
  __userIdEq?: string;
  __assetIdEq?: string;
  __productIdInAssets?: boolean;
  __idsIn?: { col: 'asset.id' | 'product.id'; ids: string[] };
};

vi.mock('drizzle-orm', () => ({
  and: (...args: WhereExpr[]) =>
    args.filter(Boolean).reduce<WhereExpr>((acc, cur) => ({ ...acc, ...cur }), {}),
  eq: (col: string, val: string): WhereExpr => {
    if (col === 'products.id') return { __productIdEq: val };
    if (col === 'products.userId') return { __userIdEq: val };
    if (col === 'assets.userId') return { __userIdEq: val };
    if (col === 'productAssets.productId') return { __productIdInAssets: true, __productIdEq: val };
    if (col === 'productAssets.assetId') return { __assetIdEq: val };
    return {};
  },
  desc: () => undefined,
  inArray: (col: string, ids: string[]): WhereExpr => {
    if (col === 'assets.id') return { __idsIn: { col: 'asset.id', ids } };
    if (col === 'products.id') return { __idsIn: { col: 'product.id', ids } };
    return {};
  },
}));

vi.mock('@/lib/db/schema', () => ({
  products: {
    id: 'products.id',
    userId: 'products.userId',
  },
  assets: {
    id: 'assets.id',
    userId: 'assets.userId',
  },
  productAssets: {
    productId: 'productAssets.productId',
    assetId: 'productAssets.assetId',
    position: 'productAssets.position',
    role: 'productAssets.role',
  },
}));

/* -------------------------------------------------------------------------- *
 * Mock the drizzle db. The chain shapes we need to handle:
 *   tx.select().from(products).where(...)           → ProductRow[]
 *   tx.select({...}).from(assets).where(...)        → { id }[]
 *   tx.select({...}).from(productAssets).where(...) → { assetId, position }[]
 *   tx.insert(productAssets).values(rows)           → inserts
 *   tx.update(assets).set(...).where(inArray(ids))  → bulk update
 * -------------------------------------------------------------------------- */

type Table = 'products' | 'assets' | 'productAssets';

function tableOf(token: unknown): Table {
  // The schema mock maps each table to a sentinel object; we tag by the
  // identity of the object the caller passes in.
  // We can't compare object identity easily after vi.mock so we sniff
  // by walking the mocked columns.
  const t = token as Record<string, string>;
  if (t?.id === 'products.id') return 'products';
  if (t?.id === 'assets.id') return 'assets';
  if (t?.productId === 'productAssets.productId') return 'productAssets';
  throw new Error('unknown table token in mock: ' + JSON.stringify(token));
}

function buildSelect() {
  let table: Table | null = null;
  let predicate: WhereExpr = {};
  const chain = {
    from(t: unknown) {
      table = tableOf(t);
      return chain;
    },
    where(p: WhereExpr) {
      predicate = p ?? {};
      return chain;
    },
    limit() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    then(onResolve: (rows: unknown[]) => unknown) {
      let rows: unknown[] = [];
      if (table === 'products') {
        rows = fixtures.products.filter(
          (p) =>
            (predicate.__productIdEq === undefined || p.id === predicate.__productIdEq) &&
            (predicate.__userIdEq === undefined || p.userId === predicate.__userIdEq),
        );
      } else if (table === 'assets') {
        const idSet = predicate.__idsIn?.col === 'asset.id' ? new Set(predicate.__idsIn.ids) : null;
        rows = fixtures.assets
          .filter(
            (a) =>
              (!idSet || idSet.has(a.id)) &&
              (predicate.__userIdEq === undefined || a.userId === predicate.__userIdEq),
          )
          .map((a) => ({ id: a.id }));
      } else if (table === 'productAssets') {
        rows = fixtures.productAssets
          .filter(
            (pa) =>
              predicate.__productIdEq === undefined || pa.productId === predicate.__productIdEq,
          )
          .map((pa) => ({ assetId: pa.assetId, position: pa.position }));
      }
      return Promise.resolve(rows).then(onResolve);
    },
  };
  return chain;
}

function buildInsert(table: Table) {
  return {
    values(rows: ProductAssetRow | ProductAssetRow[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      if (table === 'productAssets') {
        for (const r of arr) {
          fixtures.productAssetInserts.push(r);
          fixtures.productAssets.push({ ...r });
        }
      }
      const ret = { returning: () => Promise.resolve(arr) };
      return Object.assign(Promise.resolve(arr), ret, {
        onConflictDoNothing: () => Promise.resolve(arr),
      });
    },
  };
}

function buildUpdate(table: Table) {
  return {
    set(payload: Record<string, unknown>) {
      return {
        where(predicate: WhereExpr) {
          const ids = predicate.__idsIn?.ids ?? [];
          if (table === 'assets') {
            fixtures.assetUpdates.push({ ids, set: payload });
          }
          return {
            returning: () => Promise.resolve([]),
            then: (cb: (v: unknown[]) => unknown) => Promise.resolve([]).then(cb),
          };
        },
      };
    },
  };
}

const fakeTx = {
  select: (_proj?: unknown) => buildSelect(),
  insert: (t: unknown) => buildInsert(tableOf(t)),
  update: (t: unknown) => buildUpdate(tableOf(t)),
};

vi.mock('@/lib/db', () => ({
  db: {
    transaction: async <T>(fn: (tx: typeof fakeTx) => Promise<T>): Promise<T> => fn(fakeTx),
    select: (proj?: unknown) => fakeTx.select(proj),
    insert: (t: unknown) => fakeTx.insert(t),
    update: (t: unknown) => fakeTx.update(t),
  },
}));

import { appendProductImages } from './catalog';

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

function seedUser(userId: string) {
  // No-op: users not modelled in the mock, fixtures are scoped by userId only.
  return userId;
}

function seedAsset(id: string, userId: string) {
  fixtures.assets.push({ id, userId });
}

function seedProduct(opts: { id: string; userId: string; heroAssetId?: string }) {
  fixtures.products.push({
    id: opts.id,
    userId: opts.userId,
    name: 'pant',
    notes: null,
    tags: [],
    status: 'live',
    heroAssetId: opts.heroAssetId ?? null,
    usedInCount: 0,
    createdAt: new Date(0),
  });
}

function seedProductAsset(productId: string, assetId: string, position: number) {
  fixtures.productAssets.push({ productId, assetId, role: 'reference', position });
}

beforeEach(() => {
  fixtures.products.length = 0;
  fixtures.assets.length = 0;
  fixtures.productAssets.length = 0;
  fixtures.productAssetInserts.length = 0;
  fixtures.assetUpdates.length = 0;
});

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

describe('appendProductImages', () => {
  it('appends owned assets to the join, ignoring foreign ones', async () => {
    const userId = seedUser('u_owner');
    const foreignUserId = seedUser('u_foreign');
    seedAsset('a0', userId);
    seedAsset('a1', userId);
    seedAsset('a2', userId);
    seedAsset('a_foreign', foreignUserId);
    seedProduct({ id: 'p1', userId, heroAssetId: 'a0' });
    seedProductAsset('p1', 'a0', 0);

    const result = await appendProductImages({
      userId,
      productId: 'p1',
      assetIds: ['a1', 'a2', 'a_foreign'],
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(2);
    expect(result!.skippedCount).toBe(1);
    // Two new join rows, both at positions after the existing max (0).
    expect(fixtures.productAssetInserts.map((r) => r.assetId).sort()).toEqual(['a1', 'a2']);
    expect(fixtures.productAssetInserts.map((r) => r.position).sort()).toEqual([1, 2]);
    // Role for appended images is 'reference' (hero is not changed).
    expect(fixtures.productAssetInserts.every((r) => r.role === 'reference')).toBe(true);
    // Total join rows now: original + appended.
    expect(fixtures.productAssets).toHaveLength(3);
    // The bulk asset update only touched the appended (owned, new) ids.
    expect(fixtures.assetUpdates).toHaveLength(1);
    expect(fixtures.assetUpdates[0]!.ids.sort()).toEqual(['a1', 'a2']);
    expect(fixtures.assetUpdates[0]!.set).toMatchObject({ productId: 'p1', ownerType: 'product' });
  });

  it('is idempotent — duplicates are skipped not errored', async () => {
    const userId = seedUser('u_owner');
    seedAsset('a0', userId);
    seedAsset('a1', userId);
    seedProduct({ id: 'p1', userId, heroAssetId: 'a0' });
    seedProductAsset('p1', 'a0', 0);

    const result = await appendProductImages({
      userId,
      productId: 'p1',
      assetIds: ['a0', 'a1'],
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(1);
    expect(result!.skippedCount).toBe(1);
    expect(fixtures.productAssetInserts.map((r) => r.assetId)).toEqual(['a1']);
  });

  it('returns null when product is not owned', async () => {
    const userId = seedUser('u_owner');
    const foreignUserId = seedUser('u_foreign');
    seedAsset('a0', userId);
    seedAsset('a1', foreignUserId);
    seedProduct({ id: 'p1', userId, heroAssetId: 'a0' });

    const result = await appendProductImages({
      userId: foreignUserId,
      productId: 'p1',
      assetIds: ['a1'],
    });

    expect(result).toBeNull();
    expect(fixtures.productAssetInserts).toHaveLength(0);
    expect(fixtures.assetUpdates).toHaveLength(0);
  });

  it('returns added=0 when all requested ids are foreign', async () => {
    const userId = seedUser('u_owner');
    const foreignUserId = seedUser('u_foreign');
    seedAsset('a_foreign', foreignUserId);
    seedProduct({ id: 'p1', userId });

    const result = await appendProductImages({
      userId,
      productId: 'p1',
      assetIds: ['a_foreign'],
    });

    expect(result).not.toBeNull();
    expect(result!.addedCount).toBe(0);
    expect(result!.skippedCount).toBe(1);
    expect(fixtures.productAssetInserts).toHaveLength(0);
    expect(fixtures.assetUpdates).toHaveLength(0);
  });
});
