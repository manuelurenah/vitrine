'use client';

import { Bookmark, Images, Megaphone, Sparkles, Tag, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';

const COLLECTION_CARDS = [
  {
    id: 'logos',
    label: 'logos',
    slug: 'logos',
    icon: Tag,
    sub: 'your marks · partner marks',
  },
  {
    id: 'partners',
    label: 'partners',
    slug: 'partners',
    icon: Users,
    sub: 'collaborator branding',
  },
  {
    id: 'past-campaigns',
    label: 'past campaigns',
    slug: 'past campaigns',
    icon: Megaphone,
    sub: 'previous shoots, posts, ads',
  },
  {
    id: 'references',
    label: 'references',
    slug: 'references',
    icon: Bookmark,
    sub: 'mood + visual direction',
  },
] as const;

interface AssetsEmptyStateProps {
  onGenerate: () => void;
}

export function AssetsEmptyState({ onGenerate }: AssetsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      {/* icon glyph + bloom box */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-24 w-24 rounded-full blur-2xl"
          style={{ background: 'var(--volt-soft)' }}
          aria-hidden="true"
        />
        <span
          className={cn(
            'relative grid h-16 w-16 place-items-center rounded-[18px] border border-line-volt',
          )}
          style={{ background: 'rgba(0,255,157,0.12)' }}
        >
          <Images size={28} strokeWidth={1.5} className="text-volt" aria-hidden="true" />
        </span>
      </div>

      {/* gradient headline */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="font-display text-[28px] font-semibold tracking-[-0.025em] text-fg-0">
          upload your first{' '}
          <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
            asset
          </span>
          .
        </h2>
        <p className="max-w-[440px] text-[13.5px] leading-relaxed text-fg-2">
          drop a file, or pick a collection to start. assets are loose — name + tags are all we
          need.
        </p>
      </div>

      {/* big dropzone area */}
      <Link
        href="/brand/assets/new"
        className={cn(
          'group flex w-full max-w-[520px] flex-col items-center gap-3 rounded-[16px]',
          'border-2 border-dashed border-line px-8 py-10',
          'transition-colors duration-fast ease-out hover:border-line-volt hover:bg-volt-soft/40',
        )}
        aria-label="upload files"
      >
        <span
          className="grid h-11 w-11 place-items-center rounded-[12px] border border-line-volt"
          style={{ background: 'rgba(0,255,157,0.14)' }}
          aria-hidden="true"
        >
          <Upload size={20} strokeWidth={1.5} className="text-volt" aria-hidden="true" />
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-fg-0">
            drop files here
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3">
            svg · png · jpg · pdf · mp4 — up to 20 mb each
          </span>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-[10px] border border-line-volt bg-volt-soft px-4 py-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-volt group-hover:bg-volt/15"
          aria-hidden="true"
        >
          <Upload size={13} strokeWidth={1.75} aria-hidden="true" /> choose files
        </span>
      </Link>

      {/* generate button kept separate so it doesn't sit inside the dropzone link */}
      <button
        type="button"
        onClick={onGenerate}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line-volt bg-volt-soft px-4 py-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
        data-testid="open-generate-modal-empty"
      >
        <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" /> generate
      </button>

      {/* "or pick a collection" divider */}
      <div className="flex w-full max-w-[520px] items-center gap-3">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3">
          or pick a collection
        </span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      {/* 4 collection cards */}
      <div className="grid w-full max-w-[520px] grid-cols-2 gap-3 sm:grid-cols-4">
        {COLLECTION_CARDS.map((c) => {
          const Icon = c.icon;
          const href = `/brand/assets/new?collection=${encodeURIComponent(c.slug)}`;
          return (
            <Link
              key={c.id}
              href={href}
              className={cn(
                'flex flex-col items-center gap-2 rounded-[12px] border border-line-subtle bg-bg-2 px-3 py-4 text-center',
                'transition-colors duration-fast ease-out hover:border-line hover:bg-bg-3',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt',
              )}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-line-subtle"
                style={{ background: 'rgba(255,255,255,0.04)' }}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={1.5} className="text-fg-2" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-1">
                  {c.label}
                </span>
                <span className="text-[10.5px] leading-tight text-fg-3">{c.sub}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* fallback link to catalog */}
      <p className="text-[12.5px] text-fg-3">
        or{' '}
        <Link
          href="/catalog"
          className="text-fg-2 underline decoration-line-subtle underline-offset-2 hover:text-fg-0 hover:decoration-line"
        >
          add a product to your catalog →
        </Link>
      </p>
    </div>
  );
}
