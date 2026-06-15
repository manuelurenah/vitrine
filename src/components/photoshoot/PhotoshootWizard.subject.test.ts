import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/assets';
import type { Product } from '@/lib/catalog';
import { resolveProductName, resolveReferences } from './PhotoshootWizard';

/**
 * Minimal product stub — cast to Product so we only need to populate the
 * fields the resolvers actually touch (`id`, `name`, `heroAssetId`, `heroUrl`).
 */
function makeProduct(
  id: string,
  over: Partial<Product> = {},
): Product {
  return {
    id,
    userId: 'u1',
    name: `Product ${id}`,
    tags: [],
    status: 'draft',
    usedInCount: 0,
    createdAt: 0,
    ...over,
  } as Product;
}

function makeAsset(id: string, over: Partial<Asset> = {}): Asset {
  return {
    id,
    userId: 'u1',
    kind: 'upload',
    brandId: null,
    productId: null,
    bucket: 'b',
    storageKey: `uploads/${id}.png`,
    publicUrl: `https://cdn/${id}.png`,
    contentType: 'image/png',
    byteSize: null,
    width: null,
    height: null,
    dominantColor: null,
    workflowId: null,
    sourceTileId: null,
    metadata: {},
    createdAt: 0,
    ...over,
  } as Asset;
}

describe('resolveProductName', () => {
  const products: Product[] = [makeProduct('p1', { name: 'Lumen Serum' })];

  it("falls back to 'product' when no product reference is present", () => {
    expect(resolveProductName([], products)).toBe('product');
    expect(resolveProductName(['asset:a1'], products)).toBe('product');
  });

  it('resolves the name from the first product:<id> reference', () => {
    expect(resolveProductName(['product:p1', 'asset:a1'], products)).toBe('Lumen Serum');
  });

  it("falls back to 'product' when the product id is unknown", () => {
    expect(resolveProductName(['product:missing'], products)).toBe('product');
  });
});

describe('resolveReferences', () => {
  const products: Product[] = [
    makeProduct('p1', { name: 'Lumen Serum', heroAssetId: 'h1' }),
    makeProduct('p2', { name: 'No Hero', heroUrl: 'https://cdn/p2.png' }),
  ];
  const assets: Asset[] = [
    makeAsset('h1', { publicUrl: 'https://cdn/h1.png' }),
    makeAsset('a1', { storageKey: 'uploads/moodboard.png' }),
  ];

  it('marks a product reference as the product and resolves its hero asset url', () => {
    const [ref] = resolveReferences(['product:p1'], products, assets);
    expect(ref?.kind).toBe('product');
    expect(ref?.isProduct).toBe(true);
    expect(ref?.label).toBe('Lumen Serum');
    expect(ref?.thumbUrl).toBe('https://cdn/h1.png');
  });

  it('falls back to a product heroUrl when no hero asset is attached', () => {
    const [ref] = resolveReferences(['product:p2'], products, assets);
    expect(ref?.thumbUrl).toBe('https://cdn/p2.png');
  });

  it('resolves an asset reference to its filename + url and flags it not-product', () => {
    const [ref] = resolveReferences(['asset:a1'], products, assets);
    expect(ref?.kind).toBe('asset');
    expect(ref?.isProduct).toBe(false);
    expect(ref?.label).toBe('moodboard.png');
    expect(ref?.thumbUrl).toBe('https://cdn/a1.png');
  });

  it('preserves order and resolves a mixed list', () => {
    const refs = resolveReferences(['product:p1', 'asset:a1'], products, assets);
    expect(refs.map((r) => r.id)).toEqual(['product:p1', 'asset:a1']);
  });

  it('ignores ids with no recognised prefix', () => {
    expect(resolveReferences(['bogus:x'], products, assets)).toEqual([]);
  });
});
