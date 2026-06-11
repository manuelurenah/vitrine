'use client';

import {
  ChevronRight,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/components/ui';
import { FilterPills } from '@/components/campaigns/FilterPills';
import type { FilterOption } from '@/components/campaigns/FilterPills';
import type { Asset } from '@/lib/assets';
import { AdHocGenerationModal } from './AdHocGenerationModal';
import { AssetsEmptyState } from './AssetsEmptyState';

type ViewMode = 'grid' | 'list';

// Known collections in display order
const COLLECTION_ORDER = ['logos', 'partners', 'past campaigns', 'references'] as const;

export function AssetsGallery({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [genOpen, setGenOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  if (assets.length === 0) {
    return (
      <>
        <AssetsEmptyState onGenerate={() => setGenOpen(true)} />
        <AdHocGenerationModal
          open={genOpen}
          onClose={() => setGenOpen(false)}
          onSaved={() => router.refresh()}
        />
      </>
    );
  }

  // Group assets by collection (metadata.collection ?? kind)
  const byCollection = new Map<string, Asset[]>();
  for (const a of assets) {
    const col = a.metadata?.collection ?? a.kind;
    const bucket = byCollection.get(col) ?? [];
    bucket.push(a);
    byCollection.set(col, bucket);
  }

  // Build sections in known order, then any extras
  const allCollections: string[] = [];
  for (const c of COLLECTION_ORDER) {
    if (byCollection.has(c)) allCollections.push(c);
  }
  for (const k of byCollection.keys()) {
    if (!allCollections.includes(k)) allCollections.push(k);
  }

  // Filter pill options
  const filterOptions: FilterOption[] = [
    { key: 'all', label: 'all', count: assets.length },
    ...allCollections.map((c) => ({
      key: c,
      label: c,
      count: byCollection.get(c)?.length ?? 0,
    })),
  ];

  // Sections to render
  const sections =
    activeFilter === 'all'
      ? allCollections.map((c) => ({ key: c, items: byCollection.get(c) ?? [] }))
      : [
          {
            key: activeFilter,
            items: byCollection.get(activeFilter) ?? [],
          },
        ];

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          options={filterOptions}
          active={activeFilter}
          onChange={setActiveFilter}
          className="flex-1"
        />

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setGenOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-volt bg-volt-soft px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
            data-testid="open-generate-modal"
          >
            <Sparkles size={13} strokeWidth={1.75} /> generate
          </button>
          <Link
            href="/brand/assets/new"
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-volt bg-volt-soft px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
          >
            <Upload size={13} strokeWidth={1.75} /> upload
          </Link>

          {/* Grid / list toggle */}
          <div
            role="group"
            aria-label="view mode"
            className="flex overflow-hidden rounded-[9px] border border-line"
          >
            <button
              type="button"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-fast',
                viewMode === 'grid'
                  ? 'bg-bg-2 text-fg-0'
                  : 'text-fg-3 hover:bg-bg-2 hover:text-fg-1',
              )}
            >
              <LayoutGrid size={12} strokeWidth={1.75} /> grid
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 border-l border-line px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-fast',
                viewMode === 'list'
                  ? 'bg-bg-2 text-fg-0'
                  : 'text-fg-3 hover:bg-bg-2 hover:text-fg-1',
              )}
            >
              <List size={12} strokeWidth={1.75} /> list
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-8">
        {sections.map((s) => (
          <section key={s.key} className="flex flex-col gap-3">
            {/* Section header */}
            <header className="flex items-baseline gap-2">
              <h3 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-fg-0">
                {s.key}
              </h3>
              <span className="font-mono text-[11px] text-fg-3">· {s.items.length}</span>
              {activeFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFilter(s.key)}
                  className="ml-auto inline-flex items-center gap-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 hover:text-fg-1"
                >
                  view all <ChevronRight size={11} strokeWidth={2} />
                </button>
              )}
            </header>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {s.items.map((item, idx) => (
                  <AssetTile key={item.id} item={item} collection={s.key} index={idx} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {s.items.map((item) => (
                  <AssetListRow key={item.id} item={item} collection={s.key} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <AdHocGenerationModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

// ── Logo tile variant helpers ─────────────────────────────────────────────────

type LogoVariant = 'gradient' | 'outline' | 'volt';

function logoVariant(index: number): LogoVariant {
  const variants: LogoVariant[] = ['gradient', 'outline', 'volt'];
  return variants[index % 3]!;
}

function LogoTileContent({ item, index }: { item: Asset; index: number }) {
  const variant = logoVariant(index);
  const displayName = item.storageKey.split('/').pop() ?? item.id;

  const bgClass =
    variant === 'gradient'
      ? 'bg-gradient-to-br from-volt/20 via-bg-3 to-bg-2'
      : variant === 'volt'
        ? 'bg-volt-soft border border-line-volt'
        : 'bg-bg-2 border border-line';

  const letterClass =
    variant === 'gradient'
      ? 'text-volt drop-shadow-[0_0_12px_var(--volt-glow,#00ff9d66)]'
      : variant === 'volt'
        ? 'text-volt'
        : 'text-fg-0 opacity-70';

  const firstChar = displayName.charAt(0).toUpperCase();

  return (
    <>
      {item.publicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.publicUrl}
          alt={displayName}
          className="absolute inset-0 h-full w-full object-contain p-3"
          loading="lazy"
        />
      ) : (
        <span className={cn('absolute inset-0 grid place-items-center rounded-t-[10px]', bgClass)}>
          <span
            className={cn(
              'font-display text-[28px] font-extrabold tracking-[-0.04em]',
              letterClass,
            )}
          >
            {firstChar}
          </span>
        </span>
      )}
    </>
  );
}

function PartnerTileContent({ item }: { item: Asset }) {
  const displayName = item.storageKey.split('/').pop() ?? item.id;
  const partnerName =
    item.metadata?.collection === 'partners'
      ? displayName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      : displayName;

  return (
    <>
      {item.publicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.publicUrl}
          alt={displayName}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-bg-3">
          {/* dim background + centered name overlay */}
        </span>
      )}
      {/* Centered name overlay */}
      <span className="absolute inset-0 flex items-center justify-center bg-bg-0/60 backdrop-blur-[2px]">
        <span className="px-2 text-center font-display text-[12px] font-semibold leading-tight tracking-[-0.01em] text-fg-0">
          {partnerName}
        </span>
      </span>
    </>
  );
}

// ── AssetTile (grid) ──────────────────────────────────────────────────────────

function AssetTile({
  item,
  collection,
  index,
}: {
  item: Asset;
  collection: string;
  index: number;
}) {
  const isImage = item.contentType?.startsWith('image/');
  const isVideo = item.contentType?.startsWith('video/');
  const Icon = isVideo ? Video : isImage ? ImageIcon : FileText;
  const displayName = item.storageKey.split('/').pop() ?? item.id;
  const isLogo = collection === 'logos';
  const isPartner = collection === 'partners';

  return (
    <Link
      href={`/brand/assets/${item.id}`}
      aria-label={`open ${displayName}`}
      className={cn(
        'group relative flex aspect-square flex-col overflow-hidden rounded-[12px] border border-line-subtle bg-bg-2',
        'transition-colors duration-fast ease-out hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
      )}
    >
      <div className="relative flex-1 overflow-hidden bg-bg-3">
        {isLogo ? (
          <LogoTileContent item={item} index={index} />
        ) : isPartner ? (
          <PartnerTileContent item={item} />
        ) : isImage && item.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.publicUrl}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-fg-2">
            <Icon size={26} strokeWidth={1.5} />
          </span>
        )}
      </div>
      <div className="border-t border-line-subtle bg-bg-2 px-2.5 py-2">
        <div className="truncate text-[12px] text-fg-0">{displayName}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">
          {item.kind} · {item.contentType?.split('/')[1] ?? 'file'}
        </div>
      </div>
    </Link>
  );
}

// ── AssetListRow (list view) ──────────────────────────────────────────────────

function AssetListRow({ item, collection }: { item: Asset; collection: string }) {
  const isImage = item.contentType?.startsWith('image/');
  const isVideo = item.contentType?.startsWith('video/');
  const Icon = isVideo ? Video : isImage ? ImageIcon : FileText;
  const displayName = item.storageKey.split('/').pop() ?? item.id;
  const ext = item.contentType?.split('/')[1] ?? 'file';
  const size = item.byteSize != null ? formatBytes(item.byteSize) : null;

  return (
    <Link
      href={`/brand/assets/${item.id}`}
      aria-label={`open ${displayName}`}
      className={cn(
        'group flex items-center gap-3 rounded-[10px] border border-line-subtle bg-bg-2 px-3 py-2.5',
        'transition-colors duration-fast ease-out hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
      )}
    >
      {/* Thumb */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[7px] border border-line bg-bg-3">
        {isImage && item.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.publicUrl}
            alt={displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-fg-2">
            <Icon size={16} strokeWidth={1.5} />
          </span>
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-fg-0">{displayName}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">
          {collection} · {ext}
          {size ? ` · ${size}` : ''}
        </div>
      </div>
    </Link>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / 1024 / 1024).toFixed(1)} mb`;
}
