'use client';

import {
  Camera,
  ChevronRight,
  Grid,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreativeCard, GradientThumb, SectionHead } from '@/components/campaigns';
import { FilterPills } from '@/components/campaigns/FilterPills';
import { ProductPickerDialog } from '@/components/catalog';
import { Button, BuzzPill, Chip } from '@/components/ui';
import { buildCampaignNewHref } from '@/lib/campaignHref';
import type { Product } from '@/lib/catalog';
import type { Photoshoot, PhotoshootTile } from '@/lib/photoshoots';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';

type Props = {
  shoot: Photoshoot;
  products: Product[];
  sourceProduct?: Product | null;
};

type Layout = 'template' | 'grid';

// All photoshoot tiles inherit the same ratio from the brief.
function ratioToPresetId(ratio: string): 'li' | 'ig-feed' | 'ig-story' | 'yt' {
  if (ratio === '1:1') return 'li';
  if (ratio === '4:5') return 'ig-feed';
  if (ratio === '9:16') return 'ig-story';
  return 'yt';
}

/**
 * Estimate the buzz cost for regenerating all tiles in a template group.
 * Apportions the shoot's total estimated buzz by group size:
 *   cost = round(estimatedBuzz * groupTileCount / totalTileCount)
 * Falls back to 20 when no estimate exists (matches per-tile regenerate display).
 */
function computeTemplateCost(
  groupTiles: PhotoshootTile[],
  allTiles: PhotoshootTile[],
  shootEstimatedBuzz: number,
): number {
  const totalTileCount = allTiles.length;
  if (totalTileCount === 0) return 0;
  if (!shootEstimatedBuzz) return 20;
  return Math.round((shootEstimatedBuzz * groupTiles.length) / totalTileCount);
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
// SourceProductCard — left column of the 3-col results header
// ---------------------------------------------------------------------------
function SourceProductCard({
  shoot,
  sourceProduct,
}: {
  shoot: Photoshoot;
  sourceProduct?: Product | null;
}) {
  const name = sourceProduct?.name ?? shoot.brief.productName;

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-bg-2 p-4">
      <div className="flex items-center gap-3">
        {sourceProduct?.heroUrl ? (
          <img
            src={sourceProduct.heroUrl}
            alt={name}
            className="h-[52px] w-[52px] flex-none rounded-[10px] object-cover"
          />
        ) : (
          <GradientThumb tone="volt" className="h-[52px] w-[52px] flex-none" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-[13px] leading-snug text-fg-0">{name}</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.05em] text-fg-3">
            // templates · {shoot.brief.templateIds.length}
          </p>
        </div>
      </div>
      {shoot.brief.templateIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shoot.brief.templateIds.map((tid) => {
            const tpl = PHOTOSHOOT_TEMPLATES[tid];
            return (
              <Chip key={tid} active={false}>
                {tpl?.label ?? tid}
              </Chip>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhotoshootResults
// ---------------------------------------------------------------------------
export function PhotoshootResults({ shoot, products, sourceProduct }: Props) {
  const router = useRouter();

  const [selecting, setSelecting] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(() => new Set());
  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);
  // Map from templateId → whether a template-level regenerate is in flight.
  const [templateRegenerating, setTemplateRegenerating] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [layout, setLayout] = useState<Layout>('template');

  const tilesByTemplate = useMemo(() => {
    const map = new Map<string, typeof shoot.tiles>();
    for (const t of shoot.tiles) {
      const arr = map.get(t.templateId) ?? [];
      arr.push(t);
      map.set(t.templateId, arr);
    }
    return map;
  }, [shoot.tiles]);

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
    router.push(`/brand/catalog/${productId}`);
    router.refresh();
    // eslint-disable-next-line no-console
    console.info(`added ${addedCount} image${addedCount === 1 ? '' : 's'} to product`);
  }

  function startCampaignWith(assetIds: string[]) {
    if (assetIds.length === 0) return;
    router.push(buildCampaignNewHref(assetIds));
  }

  async function regenerateTemplate(templateId: string) {
    if (templateRegenerating[templateId]) return;
    setTemplateRegenerating((prev) => ({ ...prev, [templateId]: true }));
    try {
      const res = await fetch(`/api/photoshoot/${shoot.id}/templates/${templateId}/regenerate`, {
        method: 'POST',
      });
      if (res.ok) {
        // Server returns new workflowIds; router.refresh re-fetches the shoot
        // so CreativeCards remount with updated tile data and resume polling.
        router.refresh();
      }
    } finally {
      setTemplateRegenerating((prev) => ({ ...prev, [templateId]: false }));
    }
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

      {/* 3-col header: source product | title + status | actions */}
      <header className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">
        {/* LEFT — source product card */}
        <SourceProductCard shoot={shoot} sourceProduct={sourceProduct} />

        {/* CENTER — title + status */}
        <div className="flex flex-col items-start gap-3 lg:items-center lg:text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border border-line-volt bg-volt-soft px-3 py-1">
            <Camera size={13} strokeWidth={1.75} className="text-volt" />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
              photoshoot · results
            </span>
          </div>
          <h1 className="t-h2 text-fg-0">{shoot.title}</h1>
          <p className="font-mono text-[12px] text-fg-3">{statusLine}</p>
        </div>

        {/* RIGHT — actions */}
        <div className="flex flex-col items-start gap-3 lg:items-end">
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
      </header>

      {/* Filter chips + layout toggle */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterPills options={filterOptions} active={activeFilter} onChange={setActiveFilter} />
        <div
          role="group"
          aria-label="layout toggle"
          className="flex items-center gap-0.5 rounded-[8px] border border-line bg-bg-2 p-0.5"
        >
          <button
            type="button"
            aria-pressed={layout === 'template'}
            onClick={() => setLayout('template')}
            className="inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 transition-colors duration-fast ease-out hover:text-fg-0 aria-pressed:bg-bg-1 aria-pressed:text-fg-0 aria-pressed:shadow-sm"
          >
            <Layers size={11} strokeWidth={1.75} />
            by template
          </button>
          <button
            type="button"
            aria-pressed={layout === 'grid'}
            onClick={() => setLayout('grid')}
            className="inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 transition-colors duration-fast ease-out hover:text-fg-0 aria-pressed:bg-bg-1 aria-pressed:text-fg-0 aria-pressed:shadow-sm"
          >
            <Grid size={11} strokeWidth={1.75} />
            grid
          </button>
        </div>
      </div>

      {/* Content: template layout */}
      {layout === 'template' &&
        Array.from(tilesByTemplate.entries()).map(([templateId, tiles]) => {
          const tpl = PHOTOSHOOT_TEMPLATES[templateId as keyof typeof PHOTOSHOOT_TEMPLATES];
          const isRegenning = Boolean(templateRegenerating[templateId]);
          const groupCost = computeTemplateCost(
            tiles as PhotoshootTile[],
            shoot.tiles,
            shoot.estimatedBuzz,
          );
          // Hide the entire section when a filter is active and this template's
          // group doesn't match. Tiles stay mounted so CreativeCard polling continues.
          const sectionVisible = activeFilter === 'all' || tpl?.group === activeFilter;

          return (
            <section key={templateId} className={sectionVisible ? 'mt-10' : 'hidden'}>
              <SectionHead
                title={tpl?.label ?? templateId}
                count={`${tiles.length} variant${tiles.length === 1 ? '' : 's'}`}
                action={
                  <button
                    type="button"
                    aria-label={`regenerate template ${tpl?.label ?? templateId}`}
                    disabled={isRegenning}
                    onClick={() => regenerateTemplate(templateId)}
                    className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isRegenning ? (
                      <Loader2 size={11} strokeWidth={1.75} className="animate-spin" />
                    ) : (
                      <RefreshCw size={11} strokeWidth={1.75} />
                    )}
                    regenerate template · {groupCost} buzz
                  </button>
                }
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {tiles.map((tile) => {
                  const tileAssetId = tileAssetById.get(tile.id) ?? null;
                  return (
                    <CreativeCard
                      key={tile.id}
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
                  );
                })}
              </div>
            </section>
          );
        })}

      {/* Content: flat grid layout */}
      {layout === 'grid' && (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {shoot.tiles.map((tile) => {
            const tileAssetId = tileAssetById.get(tile.id) ?? null;
            // Wrap in a div rather than conditionally rendering to keep
            // CreativeCard mounted (polling must continue for cooking tiles).
            const visible = tileMatchesFilter(tile);
            return (
              <div key={tile.id} className={visible ? undefined : 'hidden'}>
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
      )}

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
