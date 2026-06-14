'use client';

import { Layers, Plus } from 'lucide-react';
import Link from 'next/link';
import { FAB } from '@/components/shell';
import { Button } from '@/components/ui';
import { useMediaQuery } from '@/components/ui/useMediaQuery';
import type { Product } from '@/lib/catalog';
import { CatalogControls } from './CatalogControls';

type Props = { products: Product[] };

export function CatalogGrid({ products }: Props) {
  const hasItems = products.length > 0;
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="relative">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="t-eyebrow">// catalog</span>
          <h1 className="mt-1 t-h2 text-fg-0">your products.</h1>
          <p className="mt-1 max-w-[520px] text-[14px] leading-[1.5] text-fg-2">
            every product becomes a chip in your brief, a source in your photoshoot.
          </p>
        </div>
        {/* Desktop-only header button; mobile uses FAB */}
        <Link href="/catalog/new" className="hidden sm:block">
          <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
            new product
          </Button>
        </Link>
      </header>

      {!hasItems ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-line bg-bg-1 p-10 text-center">
          <span
            className="flex items-center justify-center rounded-[14px] bg-volt-soft p-4"
            aria-hidden="true"
          >
            <Layers size={28} strokeWidth={1.5} className="text-volt" />
          </span>
          <div>
            <div className="font-display text-[18px] font-semibold text-fg-0">no products yet.</div>
            <p className="mt-1 max-w-[420px] text-[13.5px] text-fg-2">
              add your first product. notes feed every campaign prompt and photoshoot template.
            </p>
          </div>
          <Link href="/catalog/new">
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              new product
            </Button>
          </Link>
          <p className="text-[12.5px] text-fg-3">
            or skip for now —{' '}
            <Link
              href="/brand/assets/new"
              className="text-fg-2 underline underline-offset-2 hover:text-fg-0"
            >
              upload to assets instead →
            </Link>
          </p>
        </div>
      ) : (
        <CatalogControls products={products} />
      )}

      {/* Mobile FAB — new product */}
      {isMobile && <FAB href="/catalog/new" label="new" aria-label="new product" />}
    </div>
  );
}
