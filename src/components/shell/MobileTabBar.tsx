'use client';

import Link from 'next/link';
import { Camera, Dna, Megaphone, Video } from 'lucide-react';
import { cn } from '@/components/ui';

/**
 * The four primary tab keys. "animate" has no page route yet — its link
 * points to a future `/animate` path and is visually present but the route
 * returns 404 until that page is built.
 */
export type MobileTabId = 'campaigns' | 'photoshoot' | 'animate' | 'brand';

type TabDef = {
  id: MobileTabId;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const TABS: TabDef[] = [
  { id: 'campaigns', label: 'campaigns', href: '/campaigns', icon: Megaphone },
  { id: 'photoshoot', label: 'shoot', href: '/photoshoot', icon: Camera },
  /**
   * "animate" has no app page yet — the API route
   * `/api/generations/[id]/images/[index]/animate` exists, but there is no
   * `/animate` page. Link resolves to a 404 until Task N creates that page.
   */
  { id: 'animate', label: 'animate', href: '/animate', icon: Video },
  { id: 'brand', label: 'brand', href: '/brand', icon: Dna },
];

type Props = {
  /** Which tab is currently active. Drives the volt highlight. */
  active: MobileTabId;
};

/**
 * 76 px primary bottom tab bar.
 *
 * Positioned absolute at the bottom of its containing block (ScreenFrame).
 * Background: rgba(15,15,22,0.94) + backdrop-blur(14px).
 * Active tab: volt color + drop-shadow glow.
 * Includes faux iOS home-indicator bar at the very bottom.
 *
 * Touch targets: each tab column is min-h-[44px], meeting the §8 prereq.
 * Matches mobile-shell.jsx / vitrine-mobile.css `.m-tabbar`.
 */
export function MobileTabBar({ active }: Props) {
  return (
    <nav
      aria-label="primary"
      className="absolute bottom-0 left-0 right-0 z-20 grid grid-cols-4 items-center border-t border-line-subtle backdrop-blur-[14px]"
      style={{
        height: 76,
        paddingTop: 8,
        paddingBottom: 14,
        background: 'rgba(15,15,22,0.94)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center gap-[3px]',
              'text-[10.5px] font-medium tracking-[-0.005em] transition-colors duration-[120ms] ease-out',
              isActive ? 'text-volt' : 'text-fg-3 hover:text-fg-1',
            )}
          >
            <span
              className={cn('inline-flex', isActive && 'drop-shadow-[0_0_6px_var(--volt-glow)]')}
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}

      {/* Faux iOS home indicator */}
      <span
        aria-hidden="true"
        className="absolute bottom-[5px] left-1/2 h-1 w-[110px] -translate-x-1/2 rounded-pill bg-white/50"
      />
    </nav>
  );
}
