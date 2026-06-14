'use client';

import { ArrowLeft, Camera, Megaphone, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Props = {
  productId: string;
  campaignHref: string;
  photoshootHref: string;
};

// Shared radius so the back button, both CTAs, and the menu button read as one
// cohesive row.
const RADIUS = 'rounded-pill';

// ---------------------------------------------------------------------------
// Context menu — delete only for now. Task 8 owns the edit affordance via the
// inline-editable metadata panel, so we deliberately omit "edit" here.
// ---------------------------------------------------------------------------
function ProductActionsMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="more product actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center size-9 ${RADIUS} border border-line-subtle bg-bg-2 text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0`}
      >
        <MoreHorizontal size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 flex w-[160px] flex-col rounded-[10px] border border-line bg-bg-1 p-1 shadow-lg z-50"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-red-400 transition-colors hover:bg-bg-3 hover:text-red-300"
          >
            delete product
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header row: back button (left) · CTAs + context menu (right)
// ---------------------------------------------------------------------------
export function ProductDetailHeader({ productId, campaignHref, photoshootHref }: Props) {
  const router = useRouter();

  async function deleteProduct() {
    if (!window.confirm('delete this product? this is not reversible.')) return;
    const res = await fetch(`/api/catalog/products/${productId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/catalog');
      router.refresh();
    }
  }

  return (
    <header className="flex items-center gap-3">
      <Link
        href="/catalog"
        className={`inline-flex items-center gap-2 ${RADIUS} border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0`}
      >
        <ArrowLeft size={14} strokeWidth={1.75} /> catalog
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {/* Primary CTA — styled to match Button `primary`, kept as an anchor so
            we don't nest interactive elements. */}
        <Link
          href={campaignHref}
          className={`inline-flex h-9 items-center gap-[7px] ${RADIUS} bg-volt px-[14px] text-[13.5px] font-semibold tracking-[-0.005em] text-fg-on-volt shadow-bloom-volt-sm transition-all duration-base ease-out hover:bg-volt-hover active:translate-y-[1px]`}
        >
          <Megaphone size={15} strokeWidth={1.75} /> use in campaign
        </Link>

        {/* Secondary CTA — styled to match Button `secondary`. */}
        <Link
          href={photoshootHref}
          className={`inline-flex h-9 items-center gap-[7px] ${RADIUS} border border-line bg-bg-2 px-[14px] text-[13.5px] font-semibold tracking-[-0.005em] text-fg-0 transition-all duration-base ease-out hover:bg-bg-3 hover:border-line-strong`}
        >
          <Camera size={15} strokeWidth={1.75} /> use in photoshoot
        </Link>

        <ProductActionsMenu onDelete={deleteProduct} />
      </div>
    </header>
  );
}
