'use client';

import Link from 'next/link';
import { Camera, Dna, Images, Megaphone, Package } from 'lucide-react';
import { cn } from '@/components/ui';

/** The five primary mobile tab keys, left→right in the bottom pill. */
export type MobileTabId = 'campaigns' | 'photoshoot' | 'catalog' | 'assets' | 'brand';

type TabDef = {
  id: MobileTabId;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const TABS: TabDef[] = [
  { id: 'campaigns', label: 'campaigns', href: '/campaigns', icon: Megaphone },
  { id: 'photoshoot', label: 'shoot', href: '/photoshoot', icon: Camera },
  { id: 'catalog', label: 'catalog', href: '/catalog', icon: Package },
  { id: 'assets', label: 'assets', href: '/assets', icon: Images },
  { id: 'brand', label: 'brand', href: '/brand', icon: Dna },
];

type Props = {
  /** Which tab is currently active. Drives the volt highlight. */
  active: MobileTabId;
};

/**
 * Floating 64 px primary bottom tab bar (iOS-26 style pill).
 *
 * `position: absolute` inside a viewport-height ScreenFrame (`h-dvh`), inset
 * 12 px from the left/right edges and `calc(env(safe-area-inset-bottom) + 12px)`
 * from the bottom — so it floats above the content and clears the home
 * indicator on notched devices. Rounded 28 px pill, full border + elevation
 * shadow, backdrop blur.
 *
 * Active tab: inset `bg-volt-soft` capsule behind the column, with the volt
 * icon/label + glow on top. Touch targets stay min-h-[44px] (§8 prereq).
 */
export function MobileTabBar({ active }: Props) {
  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label="primary"
      className="absolute left-3 right-3 z-20 grid grid-cols-5 items-center rounded-[28px] border border-line-subtle backdrop-blur-[14px]"
      style={{
        height: 64,
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        background: 'rgba(15,15,22,0.94)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            data-testid={`mobile-tab-${tab.label}`}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[44px] flex-col items-center justify-center gap-[3px]',
              'text-[10.5px] font-medium tracking-[-0.005em] transition-colors duration-[120ms] ease-out',
              isActive ? 'text-volt' : 'text-fg-3 hover:text-fg-1',
            )}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-[6px] inset-y-[3px] rounded-[18px] bg-volt-soft"
              />
            )}
            <span
              className={cn(
                'relative inline-flex',
                isActive && 'drop-shadow-[0_0_6px_var(--volt-glow)]',
              )}
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className="relative">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
