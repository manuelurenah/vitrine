import { Camera, Dna, Megaphone } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavId =
  | 'dna'
  | 'overview'
  | 'catalog'
  | 'assets'
  | 'campaigns'
  | 'photoshoot';

export type NavItem = {
  id: NavId;
  label: string;
  href: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  indent?: boolean;
  shortcut?: string;
  badge?: 'new';
};

export const NAV: NavItem[] = [
  { id: 'dna', label: 'brand dna', href: '/brand', icon: Dna },
  { id: 'overview', label: 'overview', href: '/brand', indent: true },
  { id: 'catalog', label: 'catalog', href: '/catalog' },
  { id: 'assets', label: 'assets', href: '/assets' },
  { id: 'campaigns', label: 'campaigns', href: '/campaigns', icon: Megaphone, shortcut: '⌘2' },
  { id: 'photoshoot', label: 'photoshoot', href: '/photoshoot', icon: Camera, shortcut: '⌘3' },
];

/** Extract the digit from a shortcut label like '⌘2' → 2. */
export function shortcutDigit(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d)\s*$/);
  return m ? Number(m[1]) : null;
}

const PREFIX_TO_ID: Array<[string, NavId]> = [
  ['/campaigns', 'campaigns'],
  ['/photoshoot', 'photoshoot'],
  ['/catalog', 'catalog'],
  ['/assets', 'assets'],
  ['/brand', 'overview'],
];

export function activeNavFromPath(pathname: string): NavId | null {
  for (const [prefix, id] of PREFIX_TO_ID) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return id;
  }
  return null;
}
