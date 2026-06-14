'use client';

import { ChevronRight, ListChecks, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreativeCard, GradientThumb } from '@/components/campaigns';
import { FilterPills } from '@/components/campaigns/FilterPills';
import { ProductPickerDialog } from '@/components/catalog';
import { Button, BuzzPill, InlineEditText } from '@/components/ui';
import { buildCampaignNewHref } from '@/lib/campaignHref';
import type { Product } from '@/lib/catalog';
import type { Photoshoot, PhotoshootTile } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';

type Props = {
  shoot: Photoshoot;
  products: Product[];
  sourceProduct?: Product | null;
};

// All photoshoot tiles inherit the same ratio from the brief.
function ratioToPresetId(ratio: string): 'li' | 'ig-feed' | 'ig-story' | 'yt' {
  if (ratio === '1:1') return 'li';
  if (ratio === '4:5') return 'ig-feed';
  if (ratio === '9:16') return 'ig-story';
  return 'yt';
}

/**
 * Pure helper: given the set of selected tile IDs and a map from tile ID to
 * its resolved asset ID (only populated for tiles that are actually ready),
 * return the asset IDs in iteration order. Exported so unit tests can verify
 * the logic.
 */
export function computeReadyAssetIds(
  selectedTileIds: Set<string>,
  tileAssetById: Map<string, string>,
): string[] {
  const out: string[] = [];
  for (const id of selectedTileIds) {
    const assetId = tileAssetById.get(id);
    if (assetId) out.push(assetId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// PhotoshootResults
// ---------------------------------------------------------------------------
export function PhotoshootResults({ shoot, products, sourceProduct }: Props) {
  const router = useRouter();

  const [selecting, setSelecting] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(() => new Set());
  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Map tile id → resolved asset id. Only populated for tiles whose workflow
  // finished AND whose asset link is set; these are eligible for bulk actions
  // or the per-tile menu.
  const tileAssetById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of shoot.tiles) {
      if (t.status === 'done' && t.assetId) map.set(t.id, t.assetId);
    }
    return map;
  }, [shoot.tiles]);

  const presetId = ratioToPresetId(shoot.brief.ratio);
  const isCooking = shoot.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');

  // Status counts
  const doneCount = shoot.tiles.filter((t) => t.status === 'done').length;
  const cookingCount = shoot.tiles.filter(
    (t) => t.status === 'cooking' || t.status === 'queued',
  ).length;
  const totalCount = shoot.tiles.length;

  const readyAssetIds = useMemo(
    () => computeReadyAssetIds(selectedTileIds, tileAssetById),
    [selectedTileIds, tileAssetById],
  );
  const readyCount = readyAssetIds.length;
  const selectedCount = selectedTileIds.size;
  const showBulkBar = selecting && selectedCount > 0;

  const productName = sourceProduct?.name ?? shoot.brief.productName;
  const templateCount = shoot.brief.templateIds.length;

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

  function toggleSelectMode() {
    setSelecting((prev) => {
      // Leaving select mode clears the selection so it doesn't persist if
      // the user re-enters select mode later.
      if (prev) setSelectedTileIds(new Set());
      return !prev;
    });
  }

  function toggleTile(tileId: string) {
    setSelectedTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(tileId)) next.delete(tileId);
      else next.add(tileId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedTileIds(new Set());
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
    setSelecting(false);
    setSelectedTileIds(new Set());
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

      {/* Header — compact, single-row meta + actions, matching campaign detail */}
      <header className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Compact source-product reference + counts */}
          <div data-testid="pshoot-source-product" className="flex min-w-0 items-center gap-2.5">
            {sourceProduct?.heroUrl ? (
              <img
                src={sourceProduct.heroUrl}
                alt={productName}
                className="h-7 w-7 flex-none rounded-[7px] object-cover"
              />
            ) : (
              <GradientThumb tone="volt" className="h-7 w-7 flex-none rounded-[7px]" />
            )}
            <span className="truncate text-[13px] font-medium text-fg-0">{productName}</span>
            <span className="t-eyebrow truncate">
              // {templateCount} template{templateCount === 1 ? '' : 's'} · {totalCount} shot
              {totalCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <BuzzPill amount={shoot.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
            <button
              type="button"
              onClick={toggleSelectMode}
              aria-pressed={selecting}
              className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-line bg-bg-1 px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-0 aria-pressed:border-line-volt aria-pressed:bg-volt-soft aria-pressed:text-volt"
            >
              <ListChecks size={12} strokeWidth={1.75} />
              {selecting ? 'cancel' : 'select'}
            </button>
          </div>
        </div>

        <h1>
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
        <p className="font-mono text-[12px] text-fg-3">{statusLine}</p>
      </header>

      {/* Filter chips */}
      <div className="mt-6" data-testid="pshoot-filters">
        <FilterPills options={filterOptions} active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* Flat grid — same surface as the campaign detail page */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {shoot.tiles.map((tile) => {
          const tileAssetId = tileAssetById.get(tile.id) ?? null;
          // Wrap in a div rather than conditionally rendering to keep
          // CreativeCard mounted (polling must continue for cooking tiles).
          const visible = tileMatchesFilter(tile);
          return (
            <div
              key={tile.id}
              data-testid={`pshoot-tile-${tile.id}`}
              className={visible ? undefined : 'hidden'}
            >
              <CreativeCard
                workflowId={tile.workflowId}
                presetId={presetId}
                initialStatus={tile.status}
                quantity={tile.quantity}
                regenerate={{ kind: 'photoshoot', id: shoot.id, tileId: tile.id }}
                context="photoshoot"
                tileAssetId={tileAssetId}
                selectMode={selecting}
                selected={selectedTileIds.has(tile.id)}
                onToggleSelect={() => toggleTile(tile.id)}
                onUseAsProduct={(assetId) => openProductDialog([assetId])}
                onUseInCampaign={(assetId) => startCampaignWith([assetId])}
              />
            </div>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {showBulkBar && (
        <div className="fixed inset-x-0 bottom-4 z-sticky mx-auto flex w-fit items-center gap-3 rounded-pill border border-line bg-bg-1/90 px-4 py-2 shadow-bloom-volt-sm backdrop-blur-md">
          <span className="font-mono text-[12px] text-fg-1">{selectedCount} selected</span>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-0"
          >
            <X size={11} strokeWidth={1.75} /> clear
          </button>
          <span aria-hidden className="h-5 w-px bg-line" />
          <Button
            size="sm"
            variant="secondary"
            disabled={readyCount === 0}
            onClick={() => openProductDialog(readyAssetIds)}
          >
            add to product ({readyCount})
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={readyCount === 0}
            onClick={() => startCampaignWith(readyAssetIds)}
          >
            start campaign ({readyCount}) →
          </Button>
        </div>
      )}

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
