'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/components/ui/useMediaQuery';
import type { ShellUser } from '@/lib/user';
import { BrandSubTabs, type BrandSubTabId } from './BrandSubTabs';
import { type MobileTabId } from './MobileTabBar';
import { ScreenFrame } from './ScreenFrame';
import { Shell } from './Shell';

type Props = {
  user: ShellUser;
  buzzBalance?: number;
  children: ReactNode;
};

/** Derive the active MobileTabBar tab from the current pathname. */
function mobileTabFromPath(pathname: string): MobileTabId {
  if (pathname === '/campaigns' || pathname.startsWith('/campaigns/')) return 'campaigns';
  if (pathname === '/photoshoot' || pathname.startsWith('/photoshoot/')) return 'photoshoot';
  if (pathname === '/animate' || pathname.startsWith('/animate/')) return 'animate';
  // brand/* and any unrecognised path → brand tab
  return 'brand';
}

/** Derive the active BrandSubTab from the current pathname (only used on /brand routes). */
function brandSubTabFromPath(pathname: string): BrandSubTabId {
  if (pathname === '/brand/catalog' || pathname.startsWith('/brand/catalog/')) return 'catalog';
  if (pathname === '/brand/assets' || pathname.startsWith('/brand/assets/')) return 'assets';
  if (pathname === '/brand/book' || pathname.startsWith('/brand/book/')) return 'book';
  return 'dna';
}

/**
 * Client-side responsive shell switcher.
 *
 * - `useMediaQuery` defaults to `false` on the server and on first client
 *   render, so SSR always produces the desktop markup — no hydration mismatch.
 * - `children` appears in exactly ONE branch of the ternary at any time so
 *   page-level polling, effects, and subscriptions are never duplicated.
 * - On a mobile viewport the hook fires after mount, swapping to the mobile
 *   frame (one remount of children — acceptable per spec).
 */
export function AppShell({ user, buzzBalance, children }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const pathname = usePathname();

  if (isMobile) {
    const activeTab = mobileTabFromPath(pathname);
    const onBrand = activeTab === 'brand';
    const brandSubTab = onBrand ? brandSubTabFromPath(pathname) : 'dna';

    return (
      <ScreenFrame active={activeTab} leadingLogo>
        {onBrand && <BrandSubTabs active={brandSubTab} />}
        {children}
      </ScreenFrame>
    );
  }

  return (
    <Shell user={user} buzzBalance={buzzBalance}>
      {children}
    </Shell>
  );
}
