import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/assets';
import type { Product } from '@/lib/catalog';
import { resolveSubjectReference } from './PhotoshootWizard';

/**
 * Minimal product stub — cast to Product so we only need to populate the
 * fields the resolver actually touches (`id`, `heroAssetId`).
 */
function makeProduct(id: string, heroAssetId: string | undefined): Product {
  return {
    id,
    userId: 'u1',
    name: `Product ${id}`,
    tags: [],
    status: 'draft',
    heroAssetId,
    usedInCount: 0,
    createdAt: 0,
  } as Product;
}

describe('resolveSubjectReference', () => {
  const products: Product[] = [makeProduct('p1', 'h1'), makeProduct('p2', undefined)];
  const assets: Asset[] = [];

  it('returns null when subject is null', () => {
    expect(resolveSubjectReference(null, products, assets)).toBeNull();
  });

  it('returns the asset id directly for an asset subject', () => {
    // The resolver should not depend on whether `a1` is in the products or
    // assets arrays — it just unwraps the discriminator.
    expect(resolveSubjectReference({ kind: 'asset', id: 'a1' }, products, assets)).toBe('a1');
    expect(resolveSubjectReference({ kind: 'asset', id: 'a1' }, [], [])).toBe('a1');
  });

  it('returns the product heroAssetId for a product subject with a hero', () => {
    expect(resolveSubjectReference({ kind: 'product', id: 'p1' }, products, assets)).toBe('h1');
  });

  it('returns null for a product subject when heroAssetId is missing', () => {
    expect(resolveSubjectReference({ kind: 'product', id: 'p2' }, products, assets)).toBeNull();
  });

  it('returns null for a product subject not in the products list', () => {
    expect(
      resolveSubjectReference({ kind: 'product', id: 'p-missing' }, products, assets),
    ).toBeNull();
  });
});
