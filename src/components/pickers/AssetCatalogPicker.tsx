'use client';

import { Box, Check, Image as ImageIcon, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/components/ui';
import type { Asset } from '@/lib/assets';
import type { Product } from '@/lib/catalog';

type TabKey = 'products' | 'assets';

export type AssetCatalogPickerProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  className?: string;
  initialTab?: TabKey;
  /**
   * When true, assets with `kind: 'generated'` (campaign/photoshoot outputs)
   * are included in the uploads tab. Defaults to false because campaigns ask
   * for *reference* inputs (not previously-generated outputs); but product
   * creation flows want to include generated assets so the cross-flow
   * "send to product" hand-off can re-pick those images.
   */
  includeGenerated?: boolean;
};

export type FetchState<T> = {
  data: T[] | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_MAX = 4;

/**
 * Pure helper: compute the next selection set given a current selection, an
 * id being toggled, and a max cap. Always allows deselection; only adds when
 * we are under the cap. Exported for unit testing.
 */
export function computeNextSelection(current: string[], id: string, max: number): string[] {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
    return Array.from(next);
  }
  if (current.length >= max) return current;
  next.add(id);
  return Array.from(next);
}

/**
 * Pure helper: campaigns target a single product, so the products tab is
 * radio-style. Clicking the currently-selected product deselects it; clicking
 * a different product swaps (asset selections are preserved). Adding a brand
 * new product respects the overall cap.
 */
export function computeNextProductSelection(
  current: string[],
  productId: string,
  max: number,
): string[] {
  const hadThis = current.includes(productId);
  const withoutProducts = current.filter((id) => !id.startsWith('product:'));
  if (hadThis) return withoutProducts;
  if (withoutProducts.length >= max) return current;
  return [productId, ...withoutProducts];
}

/**
 * Tabbed picker that lets users select reference items from their catalog
 * (products) and uploaded assets. Controlled via `value` + `onChange`.
 *
 * `value` holds the union of selected ids across both tabs — each id is
 * prefixed with its kind (`product:<uuid>` / `asset:<uuid>`) so callers can
 * disambiguate downstream when resolving public URLs.
 */
export function AssetCatalogPicker({
  value,
  onChange,
  max = DEFAULT_MAX,
  className,
  initialTab = 'products',
  includeGenerated = false,
}: AssetCatalogPickerProps) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [products, setProducts] = useState<FetchState<Product>>({
    data: null,
    loading: true,
    error: null,
  });
  const [assets, setAssets] = useState<FetchState<Asset>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/catalog/products');
        const json = (await res.json()) as { products?: Product[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setProducts({ data: null, loading: false, error: json.error ?? 'failed' });
          return;
        }
        setProducts({ data: json.products ?? [], loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setProducts({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'failed',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/assets');
        const json = (await res.json()) as { assets?: Asset[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setAssets({ data: null, loading: false, error: json.error ?? 'failed' });
          return;
        }
        setAssets({ data: json.assets ?? [], loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setAssets({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'failed',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => new Set(value), [value]);
  const atCap = value.length >= max;

  const toggle = useCallback(
    (id: string) => {
      const next = computeNextSelection(value, id, max);
      if (next === value) return;
      onChange(next);
    },
    [value, max, onChange],
  );

  const toggleProduct = useCallback(
    (id: string) => {
      const next = computeNextProductSelection(value, id, max);
      if (next === value) return;
      onChange(next);
    },
    [value, max, onChange],
  );

  return (
    <div className={cn('flex flex-col gap-4', className)} data-testid="asset-catalog-picker">
      <div
        role="tablist"
        aria-label="Reference source"
        className="flex items-center gap-1 self-start rounded-pill border border-line-subtle bg-bg-2 p-1"
      >
        <TabButton
          active={tab === 'products'}
          onClick={() => setTab('products')}
          count={products.data?.length}
        >
          products
        </TabButton>
        <TabButton
          active={tab === 'assets'}
          onClick={() => setTab('assets')}
          count={assets.data?.length}
        >
          uploads
        </TabButton>
        <span className="ml-2 mr-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
          {value.length}/{max} selected
        </span>
      </div>

      {tab === 'products' ? (
        <ProductsTab
          state={products}
          selected={selected}
          atCap={atCap}
          max={max}
          onToggle={toggleProduct}
        />
      ) : (
        <AssetsTab
          state={assets}
          selected={selected}
          atCap={atCap}
          max={max}
          onToggle={toggle}
          includeGenerated={includeGenerated}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-fast ease-out',
        active ? 'bg-volt-soft text-volt' : 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
      )}
    >
      {children}
      {typeof count === 'number' && (
        <span className={cn('text-[10px]', active ? 'text-volt' : 'text-fg-3')}>· {count}</span>
      )}
    </button>
  );
}

export function ProductsTab({
  state,
  selected,
  atCap,
  max,
  onToggle,
}: {
  state: FetchState<Product>;
  selected: Set<string>;
  atCap: boolean;
  max: number;
  onToggle: (id: string) => void;
}) {
  if (state.loading) return <LoadingGrid />;
  if (state.error) return <ErrorState message={state.error} />;
  const items = state.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Box size={22} strokeWidth={1.5} />}
        title="no products yet."
        body="add a product to use it as a reference in generated images."
        ctaHref="/catalog"
        ctaLabel="open catalog"
      />
    );
  }

  // Single-select for products (campaign targets one product). A different
  // product swaps the current selection rather than adding — only block when
  // no product currently selected AND assets already filled the cap.
  let hasProductSelected = false;
  for (const id of selected) if (id.startsWith('product:')) hasProductSelected = true;

  return (
    <Grid>
      {items.map((p) => {
        const id = `product:${p.id}`;
        const isSelected = selected.has(id);
        const disabled = !isSelected && atCap && !hasProductSelected;
        return (
          <PickerCard
            key={id}
            label={p.name}
            sublabel={p.status}
            selected={isSelected}
            disabled={disabled}
            disabledHint={disabled ? `max ${max} references reached` : undefined}
            onClick={() => onToggle(id)}
          >
            {p.heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.heroUrl}
                alt={p.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-fg-2">
                <Box size={26} strokeWidth={1.5} />
              </span>
            )}
          </PickerCard>
        );
      })}
    </Grid>
  );
}

export function AssetsTab({
  state,
  selected,
  atCap,
  max,
  onToggle,
  includeGenerated = false,
}: {
  state: FetchState<Asset>;
  selected: Set<string>;
  atCap: boolean;
  max: number;
  onToggle: (id: string) => void;
  includeGenerated?: boolean;
}) {
  if (state.loading) return <LoadingGrid />;
  if (state.error) return <ErrorState message={state.error} />;
  const items = includeGenerated
    ? (state.data ?? [])
    : (state.data ?? []).filter((a) => a.kind !== 'generated');
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Upload size={22} strokeWidth={1.5} />}
        title="no uploads yet."
        body="upload product photos, logos, or moodboard images to use as references."
        ctaHref="/assets/new"
        ctaLabel="upload assets"
      />
    );
  }

  return (
    <Grid>
      {items.map((a) => {
        const id = `asset:${a.id}`;
        const isSelected = selected.has(id);
        const disabled = !isSelected && atCap;
        const isImage = a.contentType?.startsWith('image/');
        const filename = a.storageKey.split('/').pop() ?? a.id;
        return (
          <PickerCard
            key={id}
            label={filename}
            sublabel={`${a.kind} · ${a.contentType?.split('/')[1] ?? 'file'}`}
            selected={isSelected}
            disabled={disabled}
            disabledHint={disabled ? `max ${max} references reached` : undefined}
            onClick={() => onToggle(id)}
          >
            {isImage && a.publicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.publicUrl}
                alt={filename}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-fg-2">
                <ImageIcon size={26} strokeWidth={1.5} />
              </span>
            )}
          </PickerCard>
        );
      })}
    </Grid>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="listbox"
      aria-multiselectable
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {children}
    </div>
  );
}

function PickerCard({
  label,
  sublabel,
  selected,
  disabled,
  disabledHint,
  onClick,
  children,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={disabledHint}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-stretch gap-0 overflow-hidden rounded-[12px] border bg-bg-2 text-left transition-all duration-fast ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
        selected
          ? 'border-line-volt shadow-bloom-volt-sm'
          : 'border-line-subtle hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-40 hover:border-line-subtle',
      )}
      style={{ width: '100%' }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-bg-3">
        {children}
        {selected && (
          <span
            aria-hidden
            className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-pill bg-volt text-fg-on-volt"
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="border-t border-line-subtle px-2.5 py-2">
        <div className="truncate text-[12.5px] font-medium text-fg-0">{label}</div>
        {sublabel && (
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">
            {sublabel}
          </div>
        )}
      </div>
    </button>
  );
}

function LoadingGrid() {
  return (
    <div
      data-testid="picker-loading"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-[12px] border border-line-subtle bg-bg-2"
        >
          <div className="aspect-square w-full bg-bg-3" />
          <div className="space-y-1 px-2.5 py-2">
            <div className="h-2.5 w-3/4 rounded bg-bg-3" />
            <div className="h-2 w-1/2 rounded bg-bg-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div
      data-testid="picker-empty"
      className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-line bg-bg-2/60 px-6 py-10 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-[14px] border border-line-subtle bg-bg-3 text-fg-2">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-fg-0">
          {title}
        </h3>
        <p className="mt-1 max-w-[420px] text-[13px] text-fg-2">{body}</p>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-volt bg-volt-soft px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
      >
        <Plus size={13} strokeWidth={1.75} /> {ctaLabel}
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[12px] border border-line bg-bg-2 px-4 py-3 text-[13px] text-fg-1"
    >
      could not load — {message}
    </div>
  );
}
