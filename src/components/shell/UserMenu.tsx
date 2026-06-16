'use client';

import { ChevronDown, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar, cn } from '@/components/ui';

type Props = {
  user: { initials: string; name: string; tier?: string };
};

export function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-2 border-t border-line-subtle pt-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-[6px] pb-[2px] text-left transition-colors duration-fast ease-out hover:text-fg-0"
      >
        <Avatar initials={user.initials} size={28} />
        <div className="flex min-w-0 flex-col leading-[1.2]">
          <span className="truncate text-[12.5px] font-medium text-fg-0">{user.name}</span>
          <span className="truncate font-mono text-[10.5px] text-fg-2">
            {user.tier ?? 'member'}
          </span>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={cn(
            'ml-auto text-fg-2 transition-transform duration-base ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-overlay overflow-hidden rounded-[10px] border border-line bg-bg-2 shadow-lg">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-[10px] text-left text-[13px] text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
          >
            <Settings size={14} strokeWidth={1.75} className="text-fg-2" />
            settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="flex w-full items-center gap-2 border-t border-line-subtle px-3 py-[10px] text-left text-[13px] text-danger transition-colors duration-fast ease-out hover:bg-bg-3 disabled:opacity-60"
          >
            <LogOut size={14} strokeWidth={1.75} />
            {busy ? 'signing out…' : 'sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
