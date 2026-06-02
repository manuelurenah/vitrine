import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Asset } from '@/lib/assets';
import type { Product } from '@/lib/catalog';
import {
  AssetCatalogPicker,
  AssetsTab,
  ProductsTab,
  computeNextSelection,
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
    expect(html).toContain('href="/brand/catalog"');
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

  it('disables unselected cards when at cap and exposes the hint via title', () => {
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
    // selected p1 stays enabled; unselected p2 becomes disabled
    expect(html).toContain('disabled=""');
    expect(html).toContain('title="max 2 references reached"');
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
    const html = renderToStaticMarkup(
      <AssetCatalogPicker value={[]} onChange={() => {}} />,
    );
    // first tab (products) → aria-selected="true"; second tab (uploads) → aria-selected="false"
    expect(html.indexOf('aria-selected="true"')).toBeLessThan(html.indexOf('aria-selected="false"'));
  });

  it('renders a loading skeleton initially (effects do not run during SSR)', () => {
    const html = renderToStaticMarkup(
      <AssetCatalogPicker value={[]} onChange={() => {}} />,
    );
    expect(html).toContain('data-testid="picker-loading"');
  });
});
