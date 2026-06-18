'use client';

import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar, cn } from '@/components/ui';
import type { ShellUser } from '@/lib/user';

const THEME_KEY = 'vitrine-theme';
type Theme = 'dark' | 'light';

/**
 * Mobile account affordance — the avatar in the MobileTopBar's trailing slot.
 *
 * Tapping it opens a downward dropdown with the controls the desktop chrome
 * exposes (theme toggle + settings + sign out) that the mobile shell otherwise
 * lacks. Theme handling mirrors `ThemeToggle`: read the DOM (set by the inline
 * no-flash script), apply to `data-theme`, and persist to localStorage.
 */
export function MobileAccountMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // null until mounted so the theme label matches what the user already sees.
  const [theme, setTheme] = useState<Theme | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable — still apply visually
    }
    setTheme(next);
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  }

  const isLight = theme === 'light';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
      >
        <Avatar initials={user.initials} size={32} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-overlay w-[208px] overflow-hidden rounded-[12px] border border-line bg-bg-2 shadow-lg"
        >
          {/* identity header */}
          <div className="flex flex-col gap-0.5 border-b border-line-subtle px-3 py-2.5">
            <span className="truncate text-[13px] font-medium text-fg-0">{user.name}</span>
            <span className="truncate font-mono text-[10.5px] text-fg-2">
              {user.tier ?? 'member'}
            </span>
          </div>

          {/* theme toggle */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isLight}
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 px-3 py-[10px] text-left text-[13px] text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
          >
            {isLight ? (
              <Moon size={14} strokeWidth={1.75} className="text-fg-2" />
            ) : (
              <Sun size={14} strokeWidth={1.75} className="text-fg-2" />
            )}
            <span>theme</span>
            <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
              {theme === null ? '' : isLight ? 'light' : 'dark'}
            </span>
          </button>

          {/* settings */}
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-t border-line-subtle px-3 py-[10px] text-left text-[13px] text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
          >
            <Settings size={14} strokeWidth={1.75} className="text-fg-2" />
            settings
          </Link>

          {/* sign out */}
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className={cn(
              'flex w-full items-center gap-2 border-t border-line-subtle px-3 py-[10px]',
              'text-left text-[13px] text-danger transition-colors duration-fast ease-out',
              'hover:bg-bg-3 disabled:opacity-60',
            )}
          >
            <LogOut size={14} strokeWidth={1.75} />
            {busy ? 'signing out…' : 'sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
