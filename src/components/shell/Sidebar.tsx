'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BuzzGlyph, cn } from '@/components/ui';
import { activeNavFromPath, NAV, type NavId } from './nav';
import { UserMenu } from './UserMenu';
import { Wordmark } from './Wordmark';

type Props = {
  buzzBalance?: number;
  user: { initials: string; name: string; tier?: string };
};

function NavRow({ active, item }: { active: boolean; item: (typeof NAV)[number] }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-[10px] rounded-[8px] px-[10px] py-[7px] text-[13.5px] font-medium',
        'transition-colors duration-fast ease-out',
        item.indent ? 'pl-[38px] text-[13px]' : '',
        active
          ? 'bg-bg-2 text-fg-0 shadow-[inset_2px_0_0_var(--volt),inset_0_0_0_1px_var(--line-subtle)]'
          : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0',
      )}
    >
      {Icon ? (
        <Icon
          width={18}
          height={18}
          strokeWidth={1.75}
          className={cn('shrink-0', active ? 'text-volt' : 'text-fg-2 group-hover:text-fg-1')}
        />
      ) : null}
      <span className="truncate">{item.label}</span>
      {item.badge === 'new' ? (
        <span className="ml-auto rounded-pill border border-line-volt bg-volt-soft px-[6px] py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.04em] text-volt">
          new
        </span>
      ) : item.shortcut ? (
        <span className="ml-auto font-mono text-[10px] tracking-[0.05em] text-fg-3">
          {item.shortcut}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ buzzBalance, user }: Props) {
  const pathname = usePathname();
  const active: NavId | null = activeNavFromPath(pathname);

  const brandItems = NAV.filter((n) => ['dna', 'overview', 'catalog', 'assets'].includes(n.id));
  const workItems = NAV.filter((n) =>
    ['campaigns', 'photoshoot', 'animate', 'brandbook'].includes(n.id),
  );

  return (
    <aside
      data-testid="desktop-sidebar"
      className="flex h-full w-[232px] shrink-0 flex-col gap-1 border-r border-line-subtle bg-bg-1 p-[18px_12px_12px]"
    >
      <div className="flex items-center justify-between px-2 pb-4 pt-1">
        <Wordmark />
        <span className="rounded-[4px] border border-line px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-[0.08em] text-fg-3">
          beta
        </span>
      </div>

      {brandItems.map((item) => (
        <NavRow key={item.id} item={item} active={active === item.id} />
      ))}

      <div className="h-3" />

      {workItems.map((item) => (
        <NavRow key={item.id} item={item} active={active === item.id} />
      ))}

      <div className="mt-auto flex flex-col gap-2 rounded-[12px] border border-buzz-border bg-buzz-soft p-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-2">
          buzz balance
        </span>
        <div className="flex items-center gap-2">
          <BuzzGlyph size={20} />
          <span className="font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-buzz">
            {(buzzBalance ?? 0).toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          className="rounded-[8px] border-0 bg-buzz px-[10px] py-[7px] text-xs font-semibold text-[#0a0a0f] shadow-[0_0_14px_-3px_var(--buzz-glow)]"
        >
          top up
        </button>
      </div>

      <UserMenu user={user} />
    </aside>
  );
}
