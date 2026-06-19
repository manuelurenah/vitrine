import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- *
 * Module-level mocks — must come before any imports that chain-load these
 * -------------------------------------------------------------------------- */

// assets.ts imports env, s3, civitai, tileVersions at module load; stub them
// so the test runner doesn't need a real .env.
vi.mock('@/lib/env', () => ({
  env: { S3_BUCKET_ASSETS: 'assets', S3_BUCKET_UPLOADS: 'uploads' },
  REDIRECT_URI: 'http://localhost/api/auth/callback/civitai',
}));
vi.mock('@/lib/s3', () => ({
  presignGet: vi.fn(),
  getObjectAsDataUrl: vi.fn(),
  isLocalObjectStorage: vi.fn(() => false),
  isLocalUrl: vi.fn(() => false),
}));
vi.mock('@/lib/civitai', () => ({
  extractImageUrls: vi.fn(() => []),
}));
vi.mock('@/lib/tileVersions', () => ({
  deleteTileVersionForWorkflow: vi.fn(),
  revertTileToLatestVersion: vi.fn(),
}));

/* -------------------------------------------------------------------------- *
 * Symbol-tagged where-clause mock (same pattern as catalog.test.ts)
 * -------------------------------------------------------------------------- */

type WhereExpr = {
  __assetIdEq?: string;
  __userIdEq?: string;
  __productIdIn?: string[];
  __deletedAtIsNull?: boolean;
  __assetIdIn?: string[];
};

vi.mock('drizzle-orm', () => ({
  and: (...args: WhereExpr[]) =>
    args.filter(Boolean).reduce<WhereExpr>((acc, cur) => ({ ...acc, ...cur }), {}),
  eq: (col: string, val: string): WhereExpr => {
    if (col === 'productAssets.assetId') return { __assetIdEq: val };
    if (col === 'assets.userId') return { __userIdEq: val };
    if (col === 'productAssets.productId') return {};
    return {};
  },
  isNull: (_col: unknown): WhereExpr => ({ __deletedAtIsNull: true }),
  inArray: (col: string, ids: string[]): WhereExpr => {
    if (col === 'productAssets.productId') return { __productIdIn: ids };
    if (col === 'assets.id') return { __assetIdIn: ids };
    return {};
  },
  count: (col?: unknown) => ({ __isCount: true, col }),
  desc: () => undefined,
  ne: () => ({}),
  or: () => ({}),
}));

vi.mock('@/lib/db/schema', () => ({
  assets: {
    id: 'assets.id',
    userId: 'assets.userId',
    deletedAt: 'assets.deletedAt',
    kind: 'assets.kind',
    sourceTileId: 'assets.sourceTileId',
    bucket: 'assets.bucket',
    storageKey: 'assets.storageKey',
    createdAt: 'assets.createdAt',
  },
  productAssets: {
    productId: 'productAssets.productId',
    assetId: 'productAssets.assetId',
    position: 'productAssets.position',
    role: 'productAssets.role',
  },
  // other tables referenced by assets.ts (not under test here)
  campaignTiles: { workflowId: 'campaignTiles.workflowId', id: 'campaignTiles.id', assetId: 'campaignTiles.assetId', status: 'campaignTiles.status', updatedAt: 'campaignTiles.updatedAt' },
  photoshootTiles: { workflowId: 'photoshootTiles.workflowId', id: 'photoshootTiles.id', assetId: 'photoshootTiles.assetId', status: 'photoshootTiles.status', updatedAt: 'photoshootTiles.updatedAt' },
  products: { id: 'products.id', userId: 'products.userId', heroAssetId: 'products.heroAssetId' },
}));

/* -------------------------------------------------------------------------- *
 * Fixtures
 * -------------------------------------------------------------------------- */

type Fixture = {
  // product_assets rows: which products link to which assets
  productAssets: Array<{ productId: string; assetId: string }>;
  // assets rows: non-deleted images per product (inferred via productAssets join)
  // We store a map of productId → list of non-deleted assetIds for counting
  nonDeletedImagesByProduct: Map<string, string[]>;
};

const fixtures: Fixture = {
  productAssets: [],
  nonDeletedImagesByProduct: new Map(),
};

/* -------------------------------------------------------------------------- *
 * Mock db
 *
 * isSoleProductImage executes a chain like:
 *   db.select({ productId, imageCount: count(assets.id) })
 *     .from(productAssets)
 *     .innerJoin(assets, eq(productAssets.assetId, assets.id))
 *     .where(and(inArray(productAssets.productId, linkedProductIds), isNull(assets.deletedAt)))
 *     .groupBy(productAssets.productId)
 *
 * The mock intercepts the full chain and, in `then`, returns rows based on
 * our fixtures. We detect what query is being built by the `__productIdIn`
 * tag (looking up counts) vs `__assetIdEq` (looking up linked products).
 * -------------------------------------------------------------------------- */

type SelectChainState = {
  fromTable: string | null;
  predicate: WhereExpr;
  hasInnerJoin: boolean;
  hasGroupBy: boolean;
};

function buildSelect(_proj?: unknown) {
  const state: SelectChainState = {
    fromTable: null,
    predicate: {},
    hasInnerJoin: false,
    hasGroupBy: false,
  };

  const chain = {
    from(t: unknown) {
      const tbl = t as Record<string, string>;
      if (tbl?.assetId === 'productAssets.assetId') state.fromTable = 'productAssets';
      else if (tbl?.id === 'assets.id') state.fromTable = 'assets';
      return chain;
    },
    innerJoin(_t: unknown, _on: unknown) {
      state.hasInnerJoin = true;
      return chain;
    },
    where(p: WhereExpr) {
      state.predicate = p ?? {};
      return chain;
    },
    groupBy(_col: unknown) {
      state.hasGroupBy = true;
      return chain;
    },
    limit() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    then(onResolve: (rows: unknown[]) => unknown) {
      let rows: unknown[] = [];

      if (state.fromTable === 'productAssets' && state.predicate.__assetIdEq !== undefined) {
        // Phase 1: find products linked to this asset
        const assetId = state.predicate.__assetIdEq;
        rows = fixtures.productAssets
          .filter((pa) => pa.assetId === assetId)
          .map((pa) => ({ productId: pa.productId }));
      } else if (state.fromTable === 'productAssets' && state.predicate.__productIdIn !== undefined) {
        // Phase 2: count non-deleted images per linked product
        const productIds = state.predicate.__productIdIn ?? [];
        rows = productIds.map((productId) => {
          const images = fixtures.nonDeletedImagesByProduct.get(productId) ?? [];
          return { productId, imageCount: images.length };
        });
      }

      return Promise.resolve(rows).then(onResolve);
    },
  };
  return chain;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: (proj?: unknown) => buildSelect(proj),
    insert: () => { throw new Error('insert not expected in isSoleProductImage'); },
    update: () => { throw new Error('update not expected in isSoleProductImage'); },
  },
}));

/* -------------------------------------------------------------------------- *
 * Import after mocks
 * -------------------------------------------------------------------------- */

import { isSoleProductImage } from './assets';

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

function seedProductAsset(productId: string, assetId: string) {
  fixtures.productAssets.push({ productId, assetId });
}

function seedNonDeletedImages(productId: string, assetIds: string[]) {
  fixtures.nonDeletedImagesByProduct.set(productId, assetIds);
}

beforeEach(() => {
  fixtures.productAssets.length = 0;
  fixtures.nonDeletedImagesByProduct.clear();
});

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

describe('isSoleProductImage', () => {
  it('returns true when a linked product has exactly 1 image (this asset)', async () => {
    seedProductAsset('prod_1', 'asset_a');
    seedNonDeletedImages('prod_1', ['asset_a']);

    const result = await isSoleProductImage('user_1', 'asset_a');
    expect(result).toBe(true);
  });

  it('returns false when a linked product has 2+ non-deleted images', async () => {
    seedProductAsset('prod_1', 'asset_a');
    seedNonDeletedImages('prod_1', ['asset_a', 'asset_b']);

    const result = await isSoleProductImage('user_1', 'asset_a');
    expect(result).toBe(false);
  });

  it('returns false when the asset is linked to no product', async () => {
    // No productAssets rows for asset_a

    const result = await isSoleProductImage('user_1', 'asset_a');
    expect(result).toBe(false);
  });
});
