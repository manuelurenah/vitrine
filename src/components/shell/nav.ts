import { BookOpen, Camera, Dna, Megaphone, Video } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavId =
  | 'dna'
  | 'overview'
  | 'catalog'
  | 'assets'
  | 'campaigns'
  | 'photoshoot'
  | 'animate'
  | 'brandbook';

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
  { id: 'catalog', label: 'catalog', href: '/brand/catalog', indent: true },
  { id: 'assets', label: 'assets', href: '/brand/assets', indent: true },
  { id: 'campaigns', label: 'campaigns', href: '/campaigns', icon: Megaphone, shortcut: '⌘2' },
  { id: 'photoshoot', label: 'photoshoot', href: '/photoshoot', icon: Camera, shortcut: '⌘3' },
  { id: 'animate', label: 'animate', href: '/animate', icon: Video, badge: 'new' },
  { id: 'brandbook', label: 'brand book', href: '/brand/book', icon: BookOpen, badge: 'new' },
];

const PREFIX_TO_ID: Array<[string, NavId]> = [
  ['/campaigns', 'campaigns'],
  ['/photoshoot', 'photoshoot'],
  ['/animate', 'animate'],
  ['/brand/book', 'brandbook'],
  ['/brand/catalog', 'catalog'],
  ['/brand/assets', 'assets'],
  ['/brand', 'overview'],
];

export function activeNavFromPath(pathname: string): NavId | null {
  for (const [prefix, id] of PREFIX_TO_ID) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return id;
  }
  return null;
}
