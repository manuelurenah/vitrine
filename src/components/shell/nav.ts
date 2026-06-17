import { Camera, Dna, Frame, Megaphone } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavId =
  | 'dna'
  | 'overview'
  | 'catalog'
  | 'assets'
  | 'campaigns'
  | 'photoshoot'
  | 'ads';

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
  { id: 'ads', label: 'ads', href: '/ads', icon: Frame, shortcut: '⌘4' },
];

const PREFIX_TO_ID: Array<[string, NavId]> = [
  ['/campaigns', 'campaigns'],
  ['/photoshoot', 'photoshoot'],
  ['/ads', 'ads'],
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
