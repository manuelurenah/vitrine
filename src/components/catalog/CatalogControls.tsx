'use client';

import { Image, LayoutGrid, List, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GradientThumb, type ThumbTone } from '@/components/campaigns';
import { Badge, Chip, Select, cn } from '@/components/ui';
import type { Product, ProductStatus } from '@/lib/catalog';

const TONES: ThumbTone[] = ['volt', 'ion', 'ultraviolet', 'flux', 'buzz'];

type SortKey = 'recent' | 'name' | 'status';
type ViewMode = 'grid' | 'list';
type FilterKey = 'all' | ProductStatus;

function sortProducts(products: Product[], sort: SortKey): Product[] {
  const copy = [...products];
  if (sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'status') {
    const order: Record<ProductStatus, number> = { live: 0, draft: 1, archived: 2 };
    copy.sort((a, b) => order[a.status] - order[b.status]);
  } else {
    // recent — already sorted desc by server, preserve that order
    copy.sort((a, b) => b.createdAt - a.createdAt);
  }
  return copy;
}

/* ─────────────────────────────────────────
   Per-card more (•••) menu
   ───────────────────────────────────────── */
function CardMenu({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function handleDelete() {
    if (deleting) return;
    setOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/catalog/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={menuRef} className="absolute right-2 top-2 z-10">
      <button
        type="button"
        aria-label="product actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'grid size-7 place-items-center rounded-[6px] bg-bg-0/70 text-fg-0 backdrop-blur transition-colors',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          open && 'opacity-100',
          'hover:bg-bg-2',
        )}
      >
        <MoreHorizontal size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 flex w-[160px] flex-col rounded-[10px] border border-line bg-bg-1 p-1 shadow-lg"
        >
          <Link
            href={`/catalog/${productId}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0"
          >
            <Pencil size={14} strokeWidth={1.75} />
            edit
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            {deleting ? 'deleting…' : 'delete'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Grid card
   ───────────────────────────────────────── */
function GridCard({ product, index }: { product: Product; index: number }) {
  // Photo-count badge: Product has no per-product image count field.
  // We show "1" only when heroUrl is present as a best-effort indicator.
  const photoCount = product.heroUrl ? 1 : null;

  return (
    <article className="group relative flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong">
      <Link
        href={`/catalog/${product.id}`}
        className="absolute inset-0 rounded-[14px]"
        aria-label={product.name}
      />
      {product.heroUrl ? (
        <div className="relative aspect-square overflow-hidden rounded-[10px] border border-line bg-bg-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.heroUrl}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {photoCount !== null && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-pill bg-bg-0/70 px-[7px] py-[3px] font-mono text-[10px] text-fg-1 backdrop-blur">
              <Image size={9} strokeWidth={1.75} aria-hidden />
              {photoCount}
            </span>
          )}
        </div>
      ) : (
        <GradientThumb tone={TONES[index % TONES.length]} className="aspect-square" />
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-fg-0">{product.name}</span>
          <Badge
            kind={
              product.status === 'live'
                ? 'live'
                : product.status === 'archived'
                  ? 'archived'
                  : 'draft'
            }
          >
            {product.status}
          </Badge>
        </div>
        <div className="font-mono text-[10.5px] text-fg-3">
          {product.tags.length} tag{product.tags.length === 1 ? '' : 's'}
        </div>
      </div>
      <CardMenu productId={product.id} />
    </article>
  );
}

/* ─────────────────────────────────────────
   List row
   ───────────────────────────────────────── */
function ListRow({ product, index }: { product: Product; index: number }) {
  return (
    <article className="group relative flex items-center gap-3 rounded-[10px] border border-line-subtle bg-bg-2 px-3 py-2.5 transition-all duration-base ease-out hover:border-line-strong">
      <Link
        href={`/catalog/${product.id}`}
        className="absolute inset-0 rounded-[10px]"
        aria-label={product.name}
      />
      <div className="size-10 shrink-0 overflow-hidden rounded-[7px] border border-line bg-bg-3">
        {product.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.heroUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <GradientThumb tone={TONES[index % TONES.length]} className="h-full w-full" />
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg-0">
        {product.name}
      </span>
      <Badge
        kind={
          product.status === 'live' ? 'live' : product.status === 'archived' ? 'archived' : 'draft'
        }
      >
        {product.status}
      </Badge>
      <span className="hidden font-mono text-[10.5px] text-fg-3 sm:block">
        {product.tags.length} tag{product.tags.length === 1 ? '' : 's'}
      </span>
      <CardMenu productId={product.id} />
    </article>
  );
}

/* ─────────────────────────────────────────
   Main controls + layout
   ───────────────────────────────────────── */
export function CatalogControls({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [view, setView] = useState<ViewMode>('grid');

  const filtered = products.filter((p) => filter === 'all' || p.status === filter);
  const sorted = sortProducts(filtered, sort);

  const counts = {
    all: products.length,
    live: products.filter((p) => p.status === 'live').length,
    draft: products.filter((p) => p.status === 'draft').length,
    archived: products.filter((p) => p.status === 'archived').length,
  };

  return (
    <>
      {/* toolbar: chips + sort + view toggle */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} role="button" tabIndex={0}>
          all · {counts.all}
        </Chip>
        <Chip
          active={filter === 'live'}
          onClick={() => setFilter('live')}
          role="button"
          tabIndex={0}
        >
          live · {counts.live}
        </Chip>
        <Chip
          active={filter === 'draft'}
          onClick={() => setFilter('draft')}
          role="button"
          tabIndex={0}
        >
          draft · {counts.draft}
        </Chip>
        <Chip
          active={filter === 'archived'}
          onClick={() => setFilter('archived')}
          role="button"
          tabIndex={0}
        >
          archived · {counts.archived}
        </Chip>

        {/* spacer */}
        <span className="flex-1" />

        {/* sort dropdown */}
        <div className="w-[130px]">
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="sort products"
          >
            <option value="recent">recent</option>
            <option value="name">name</option>
            <option value="status">status</option>
          </Select>
        </div>

        {/* grid / list segmented toggle */}
        <div
          role="group"
          aria-label="view mode"
          className="flex items-center rounded-[9px] border border-line bg-bg-2 p-[3px]"
        >
          <button
            type="button"
            aria-label="grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={cn(
              'flex items-center justify-center rounded-[6px] p-1.5 transition-colors duration-fast',
              view === 'grid'
                ? 'bg-volt-soft text-volt'
                : 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
            )}
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="list view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={cn(
              'flex items-center justify-center rounded-[6px] p-1.5 transition-colors duration-fast',
              view === 'list'
                ? 'bg-volt-soft text-volt'
                : 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
            )}
          >
            <List size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* grid or list */}
      {sorted.length === 0 ? (
        <div className="mt-8 rounded-[12px] border border-dashed border-line bg-bg-1 px-6 py-8 text-center">
          <p className="text-[13.5px] text-fg-2">
            no products match this filter.{' '}
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-fg-0 underline underline-offset-2 hover:text-volt"
            >
              clear filter →
            </button>
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((p, i) => (
            <GridCard key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {sorted.map((p, i) => (
            <ListRow key={p.id} product={p} index={i} />
          ))}
        </div>
      )}

    </>
  );
}
