import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '@/lib/assets';
import type { Product } from '@/lib/catalog';
import {
  AssetCatalogPicker,
  AssetsTab,
  computeNextProductSelection,
  computeNextSelection,
  ProductsTab,
} from './AssetCatalogPicker';

/* -------------------------------------------------------------------------- */
/* fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    userId: 'u1',
    name: 'Sample Product',
    tags: [],
    status: 'live',
    usedInCount: 0,
    createdAt: 0,
    ...over,
  };
}

function makeAsset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a1',
    userId: 'u1',
    kind: 'upload',
    brandId: null,
    productId: null,
    bucket: 'assets',
    storageKey: 'assets/a1/logo.png',
    publicUrl: 'https://cdn.example/a1/logo.png',
    contentType: 'image/png',
    byteSize: 1234,
    width: 100,
    height: 100,
    dominantColor: null,
    workflowId: null,
    sourceTileId: null,
    metadata: {},
    createdAt: 0,
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* computeNextSelection — pure helper                                          */
/* -------------------------------------------------------------------------- */

describe('computeNextSelection', () => {
  it('adds an id when not present and under cap', () => {
    expect(computeNextSelection([], 'a', 4)).toEqual(['a']);
    expect(computeNextSelection(['a'], 'b', 4)).toEqual(['a', 'b']);
  });

  it('removes an id when already present (regardless of cap)', () => {
    expect(computeNextSelection(['a'], 'a', 4)).toEqual([]);
    expect(computeNextSelection(['a', 'b', 'c', 'd'], 'b', 4)).toEqual(['a', 'c', 'd']);
  });

  it('refuses to add beyond the cap and returns the same reference', () => {
    const current = ['a', 'b', 'c', 'd'];
    const result = computeNextSelection(current, 'e', 4);
    expect(result).toBe(current);
  });

  it('always allows deselection even when at cap', () => {
    expect(computeNextSelection(['a', 'b', 'c', 'd'], 'a', 4)).toEqual(['b', 'c', 'd']);
  });

  it('honors custom max values', () => {
    expect(computeNextSelection(['a'], 'b', 1)).toEqual(['a']); // refused
    expect(computeNextSelection([], 'a', 1)).toEqual(['a']);
  });
});

/* -------------------------------------------------------------------------- */
/* ProductsTab / AssetsTab — static rendering                                  */
/* -------------------------------------------------------------------------- */

describe('ProductsTab rendering', () => {
  it('shows a loading skeleton while loading', () => {
    const html = renderToStaticMarkup(
      <ProductsTab
        state={{ data: null, loading: true, error: null }}
        selected={new Set()}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('data-testid="picker-loading"');
  });

  it('shows an empty state when there are no products', () => {
    const html = renderToStaticMarkup(
      <ProductsTab
        state={{ data: [], loading: false, error: null }}
        selected={new Set()}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('data-testid="picker-empty"');
    expect(html).toContain('no products yet');
    expect(html).toContain('href="/catalog"');
  });

  it('renders one card per product with controlled selection state', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Alpha' }),
      makeProduct({ id: 'p2', name: 'Beta' }),
    ];
    const html = renderToStaticMarkup(
      <ProductsTab
        state={{ data: products, loading: false, error: null }}
        selected={new Set(['product:p2'])}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    // p2 is selected → aria-selected="true" present at least once
    expect(html.match(/aria-selected="true"/g)?.length ?? 0).toBe(1);
    expect(html.match(/aria-selected="false"/g)?.length ?? 0).toBe(1);
  });

  it('allows swapping between products when one is already selected even at cap', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Alpha' }),
      makeProduct({ id: 'p2', name: 'Beta' }),
    ];
    const html = renderToStaticMarkup(
      <ProductsTab
        state={{ data: products, loading: false, error: null }}
        selected={new Set(['product:p1'])}
        atCap
        max={2}
        onToggle={() => {}}
      />,
    );
    // Single-product invariant: clicking a different product swaps, so both
    // cards stay enabled at cap.
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('max 2 references reached');
  });

  it('disables unselected products when at cap and no product currently selected', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Alpha' }),
      makeProduct({ id: 'p2', name: 'Beta' }),
    ];
    const html = renderToStaticMarkup(
      <ProductsTab
        state={{ data: products, loading: false, error: null }}
        selected={new Set(['asset:a1', 'asset:a2'])}
        atCap
        max={2}
        onToggle={() => {}}
      />,
    );
    // No product selected; cap reached via assets — block adding any product.
    expect(html).toContain('disabled=""');
    expect(html).toContain('title="max 2 references reached"');
  });
});

describe('computeNextProductSelection', () => {
  it('adds product when none currently selected (under cap)', () => {
    expect(computeNextProductSelection([], 'product:p1', 4)).toEqual(['product:p1']);
    expect(computeNextProductSelection(['asset:a1'], 'product:p1', 4)).toEqual([
      'product:p1',
      'asset:a1',
    ]);
  });

  it('deselects the product when clicked twice', () => {
    expect(computeNextProductSelection(['product:p1', 'asset:a1'], 'product:p1', 4)).toEqual([
      'asset:a1',
    ]);
  });

  it('swaps products when a different one is picked, keeping assets', () => {
    expect(
      computeNextProductSelection(['product:p1', 'asset:a1', 'asset:a2'], 'product:p2', 4),
    ).toEqual(['product:p2', 'asset:a1', 'asset:a2']);
  });

  it('refuses to add a product when no product selected and cap reached', () => {
    const current = ['asset:a1', 'asset:a2', 'asset:a3', 'asset:a4'];
    const result = computeNextProductSelection(current, 'product:p1', 4);
    expect(result).toBe(current);
  });

  it('allows swap even when total is at cap', () => {
    const current = ['product:p1', 'asset:a1', 'asset:a2', 'asset:a3'];
    expect(computeNextProductSelection(current, 'product:p2', 4)).toEqual([
      'product:p2',
      'asset:a1',
      'asset:a2',
      'asset:a3',
    ]);
  });
});

describe('AssetsTab rendering', () => {
  it('shows a loading skeleton while loading', () => {
    const html = renderToStaticMarkup(
      <AssetsTab
        state={{ data: null, loading: true, error: null }}
        selected={new Set()}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('data-testid="picker-loading"');
  });

  it('shows an empty state when there are no uploads', () => {
    const html = renderToStaticMarkup(
      <AssetsTab
        state={{ data: [], loading: false, error: null }}
        selected={new Set()}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('data-testid="picker-empty"');
    expect(html).toContain('no uploads yet');
    expect(html).toContain('href="/brand/assets/new"');
  });

  it('filters out generated assets — only user uploads/references count', () => {
    const items = [
      makeAsset({ id: 'a1', kind: 'upload', storageKey: 'a1/logo.png' }),
      makeAsset({ id: 'a2', kind: 'generated', storageKey: 'a2/cooked.png' }),
    ];
    const html = renderToStaticMarkup(
      <AssetsTab
        state={{ data: items, loading: false, error: null }}
        selected={new Set()}
        atCap={false}
        max={4}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('logo.png');
    expect(html).not.toContain('cooked.png');
  });

  it('disables unselected cards when at cap', () => {
    const items = [
      makeAsset({ id: 'a1', storageKey: 'a1/one.png' }),
      makeAsset({ id: 'a2', storageKey: 'a2/two.png' }),
    ];
    const html = renderToStaticMarkup(
      <AssetsTab
        state={{ data: items, loading: false, error: null }}
        selected={new Set(['asset:a1'])}
        atCap
        max={1}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('title="max 1 references reached"');
  });
});

/* -------------------------------------------------------------------------- */
/* AssetCatalogPicker — integration via mocked fetch                           */
/* -------------------------------------------------------------------------- */

describe('AssetCatalogPicker', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/catalog/products')) {
        return Promise.resolve(
          new Response(JSON.stringify({ products: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (url.includes('/api/assets')) {
        return Promise.resolve(
          new Response(JSON.stringify({ assets: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders both tabs and shows the selection counter', () => {
    const html = renderToStaticMarkup(
      <AssetCatalogPicker value={[]} onChange={() => {}} max={4} />,
    );
    expect(html).toContain('products');
    expect(html).toContain('uploads');
    expect(html).toContain('0/4 selected');
    // tabs use role="tab"
    expect(html.match(/role="tab"/g)?.length ?? 0).toBe(2);
  });

  it('reflects the controlled value in the selected counter', () => {
    const html = renderToStaticMarkup(
      <AssetCatalogPicker value={['product:p1', 'asset:a1']} onChange={() => {}} max={4} />,
    );
    expect(html).toContain('2/4 selected');
  });

  it('respects a custom max', () => {
    const html = renderToStaticMarkup(
      <AssetCatalogPicker value={['product:p1']} onChange={() => {}} max={2} />,
    );
    expect(html).toContain('1/2 selected');
  });

  it('marks the products tab as selected by default', () => {
    const html = renderToStaticMarkup(<AssetCatalogPicker value={[]} onChange={() => {}} />);
    // first tab (products) → aria-selected="true"; second tab (uploads) → aria-selected="false"
    expect(html.indexOf('aria-selected="true"')).toBeLessThan(
      html.indexOf('aria-selected="false"'),
    );
  });

  it('renders a loading skeleton initially (effects do not run during SSR)', () => {
    const html = renderToStaticMarkup(<AssetCatalogPicker value={[]} onChange={() => {}} />);
    expect(html).toContain('data-testid="picker-loading"');
  });
});
