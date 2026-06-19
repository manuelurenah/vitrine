'use client';

import { Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button, cn, Input, Modal, Spinner } from '@/components/ui';
import type { Product } from '@/lib/catalog';

/* -------------------------------------------------------------------------- */
/* types                                                                       */
/* -------------------------------------------------------------------------- */

export type ProductPickerDialogProps = {
  initialProducts: Product[];
  assetIds: string[];
  onClose: () => void;
  onSuccess: (productId: string, addedCount: number) => void;
};

/* -------------------------------------------------------------------------- */
/* pure helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build the deep-link to `/catalog/new` that pre-stages the chosen assets
 * via the `images=` query param. Matches the encoding contract expected by the
 * new-product page (single `encodeURIComponent` over the whole comma-joined
 * `asset:<id>` list).
 */
export function buildNewProductHref(assetIds: string[]): string {
  const joined = assetIds.map((id) => `asset:${id}`).join(',');
  return `/catalog/new?images=${encodeURIComponent(joined)}`;
}

function filterProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

/* -------------------------------------------------------------------------- */
/* component                                                                   */
/* -------------------------------------------------------------------------- */

export function ProductPickerDialog({
  initialProducts,
  assetIds,
  onClose,
  onSuccess,
}: ProductPickerDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gate close while a request is in flight — ESC + backdrop click must be
  // no-ops so we don't fire onSuccess against an unmounted dialog.
  const inFlight = submittingId !== null;
  const guardedClose = useCallback(() => {
    if (inFlight) return;
    onClose();
  }, [inFlight, onClose]);

  const filtered = useMemo(() => filterProducts(initialProducts, query), [initialProducts, query]);

  const isEmpty = initialProducts.length === 0;

  async function onPick(productId: string) {
    setSubmittingId(productId);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/products/${productId}/images`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetIds }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        addedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmittingId(null);
        return;
      }
      onSuccess(productId, body.addedCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'attach failed');
      setSubmittingId(null);
    }
  }

  function onNewProduct() {
    router.push(buildNewProductHref(assetIds));
  }

  const footer = isEmpty ? null : (
    <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={onClose} disabled={inFlight}>
        cancel
      </Button>
      <Button
        variant="primary"
        leadingIcon={<Plus size={14} strokeWidth={1.75} />}
        onClick={onNewProduct}
        disabled={inFlight}
        data-testid="product-picker-new"
      >
        + new product
      </Button>
    </div>
  );

  return (
    <Modal
      open
      onClose={guardedClose}
      eyebrow="// add to product"
      title="pick a product."
      maxWidth={520}
      footer={footer}
    >
      <div data-testid="product-picker-dialog">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-[13px] text-fg-2">no products yet.</p>
            <Button
              variant="primary"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={onNewProduct}
              disabled={inFlight}
              data-testid="product-picker-new"
            >
              + new product
            </Button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="search products…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                data-testid="product-picker-search"
                aria-label="search products"
              />
            </div>

            <ul className="flex flex-col gap-1" data-testid="product-picker-list">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-fg-3">no matches.</li>
              ) : (
                filtered.map((p) => {
                  const busy = submittingId === p.id;
                  const disabled = submittingId !== null;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(p.id)}
                        data-testid={`product-picker-item-${p.id}`}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left',
                          'transition-colors duration-fast ease-out',
                          'hover:bg-bg-2 focus-visible:bg-bg-2',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
                          disabled && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        {p.heroUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.heroUrl}
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded-[8px] border border-line-subtle bg-bg-2 object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3"
                          >
                            {p.name.slice(0, 2)}
                          </span>
                        )}
                        <span className="flex flex-1 flex-col">
                          <span className="text-[13.5px] text-fg-0">{p.name}</span>
                          {p.tags.length > 0 && (
                            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
                              {p.tags.slice(0, 3).join(' · ')}
                            </span>
                          )}
                        </span>
                        {busy && (
                          <Spinner
                            size={14}
                            className="text-fg-2"
                            label="attaching"
                          />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {error && (
              <div
                role="alert"
                className="mt-3 rounded-[10px] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger"
                data-testid="product-picker-error"
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
