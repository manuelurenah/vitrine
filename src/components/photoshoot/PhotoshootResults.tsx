'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FilterPills } from '@/components/campaigns/FilterPills';
import { ProductPickerDialog } from '@/components/catalog';
import { BuzzPill, InlineEditText } from '@/components/ui';
import { buildCampaignNewHref } from '@/lib/campaignHref';
import type { Product } from '@/lib/catalog';
import type { Photoshoot, PhotoshootTile } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';
import { PhotoshootResultRow } from './PhotoshootResultRow';

type Props = {
  shoot: Photoshoot;
  products: Product[];
};

// ---------------------------------------------------------------------------
// PhotoshootResults
// ---------------------------------------------------------------------------
export function PhotoshootResults({ shoot, products }: Props) {
  const router = useRouter();

  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Per-variant asset ids now live in each row: PhotoshootResultRow derives the
  // first variant's asset id directly from `tile.assetId` (slots > 0 have no
  // linked asset). No detail-level tile→asset map is needed anymore.

  const isCooking = shoot.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');

  // Status counts
  const doneCount = shoot.tiles.filter((t) => t.status === 'done').length;
  const cookingCount = shoot.tiles.filter(
    (t) => t.status === 'cooking' || t.status === 'queued',
  ).length;
  const totalCount = shoot.tiles.length;

  // Build filter options from unique template groups present in the shoot's tiles
  const filterOptions = useMemo(() => {
    const groupCounts = new Map<string, number>();
    for (const tile of shoot.tiles) {
      const tpl = PHOTOSHOOT_TEMPLATES[tile.templateId];
      if (tpl) {
        groupCounts.set(tpl.group, (groupCounts.get(tpl.group) ?? 0) + 1);
      }
    }
    const opts = [{ key: 'all', label: 'all', count: totalCount }];
    for (const [group, count] of groupCounts) {
      opts.push({ key: group, label: group, count });
    }
    return opts;
  }, [shoot.tiles, totalCount]);

  function tileMatchesFilter(tile: PhotoshootTile): boolean {
    if (activeFilter === 'all') return true;
    const tpl = PHOTOSHOOT_TEMPLATES[tile.templateId];
    return tpl?.group === activeFilter;
  }

  function openProductDialog(assetIds: string[]) {
    if (assetIds.length === 0) return;
    setDialogAssetIds(assetIds);
  }

  function onDialogClose() {
    setDialogAssetIds([]);
  }

  function onDialogSuccess(productId: string, addedCount: number) {
    setDialogAssetIds([]);
    router.push(`/catalog/${productId}`);
    router.refresh();
    console.info(`added ${addedCount} image${addedCount === 1 ? '' : 's'} to product`);
  }

  function startCampaignWith(assetIds: string[]) {
    if (assetIds.length === 0) return;
    router.push(buildCampaignNewHref(assetIds));
  }

  const statusLine =
    cookingCount > 0
      ? `${doneCount} of ${totalCount} shots ready · ${cookingCount} still cooking`
      : `${doneCount} of ${totalCount} shots ready`;

  return (
    <div className="relative">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <Link
          href="/photoshoot"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          photoshoot
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">{shoot.title}</span>
      </nav>

      {/* Header — title + total buzz / cooking on one row, matching campaign detail */}
      <header className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1">
            <InlineEditText
              value={shoot.title}
              ariaLabel="edit photoshoot title"
              className="t-h2 block w-full text-fg-0"
              onSave={async (title) => {
                const res = await fetch(`/api/photoshoot/${shoot.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ title }),
                });
                if (!res.ok) throw new Error(`photoshoot patch failed: ${res.status}`);
                router.refresh();
              }}
            />
          </h1>
          {/* Total buzz + cooking indicator, aligned with the title */}
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 pt-1">
            <BuzzPill amount={shoot.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
          </div>
        </div>
        <p className="font-mono text-[12px] text-fg-3">{statusLine}</p>
      </header>

      {/* Filter chips */}
      <div className="mt-6" data-testid="pshoot-filters">
        <FilterPills options={filterOptions} active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Per-style rows — one row per tile, mirroring the campaign detail page */}
      <div className="mt-6 flex flex-col">
        {shoot.tiles.map((tile) => {
          // Wrap in a div rather than conditionally rendering to keep
          // PhotoshootResultRow mounted (polling must continue for cooking tiles).
          const visible = tileMatchesFilter(tile);
          return (
            <div
              key={tile.id}
              data-testid={`pshoot-tile-${tile.id}`}
              className={visible ? undefined : 'hidden'}
            >
              <PhotoshootResultRow
                shootId={shoot.id}
                tile={tile}
                ratio={shoot.brief.ratio}
                onUseAsProduct={(id) => openProductDialog([id])}
                onUseInCampaign={(id) => startCampaignWith([id])}
              />
            </div>
          );
        })}
      </div>

      {/* Product picker dialog */}
      {dialogAssetIds.length > 0 && (
        <ProductPickerDialog
          initialProducts={products}
          assetIds={dialogAssetIds}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </div>
  );
}
