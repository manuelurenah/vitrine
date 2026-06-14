'use client';

import Link from 'next/link';
import { cn } from '@/components/ui';

export type BrandSubTabId = 'dna' | 'assets' | 'book';

type SubTabDef = {
  id: BrandSubTabId;
  label: string;
  href: string;
};

const SUB_TABS: SubTabDef[] = [
  { id: 'dna', label: 'dna', href: '/brand' },
  { id: 'assets', label: 'assets', href: '/brand/assets' },
  /**
   * "book" (/brand/book) has no page route yet — the route returns 404
   * until that page is built. Link is present for visual completeness
   * per the design spec.
   */
  { id: 'book', label: 'book', href: '/brand/book' },
];

type Props = {
  /** Which sub-tab is currently active. */
  active: BrandSubTabId;
  className?: string;
};

/**
 * Inner sub-tab strip for the Brand section on mobile.
 *
 * Tabs: `dna · catalog · assets · book` (lowercase).
 * Active tab: volt text + volt underline indicator.
 * Inactive tabs: fg-2 text.
 *
 * Scrolls horizontally when the viewport is very narrow (edge case),
 * but at 390 px all four tabs comfortably fit.
 *
 * Touch targets: each tab is min-h-[44px] (§8 prereq).
 *
 * Matches mobile-app.jsx brand sub-tab pattern.
 */
export function BrandSubTabs({ active, className }: Props) {
  return (
    <nav
      aria-label="brand sections"
      className={cn(
        'flex overflow-x-auto border-b border-line-subtle',
        // Hide scrollbar (shows on Android)
        '[&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
        className,
      )}
    >
      {SUB_TABS.map((tab) => {
        const isActive = tab.id === active;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[44px] shrink-0 items-center px-4',
              'text-[13px] font-medium tracking-[-0.005em]',
              'transition-colors duration-[120ms] ease-out',
              isActive ? 'text-volt' : 'text-fg-2 hover:text-fg-0',
            )}
          >
            {tab.label}
            {/* Active underline indicator */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-volt"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
