'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageTransition } from '@/components/ui';

/** Animates the route content slot in on navigation. Keyed on pathname so each
 *  route change re-mounts + replays the entrance; the shell chrome (rendered by
 *  AppShell, outside this wrapper) is unaffected. Enter-only. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <PageTransition motionKey={pathname}>{children}</PageTransition>;
}
