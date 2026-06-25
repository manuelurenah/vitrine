'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NAV, shortcutDigit } from './nav';

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useNavShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const bindings = NAV.filter((i) => shortcutDigit(i.shortcut) != null).map((i) => ({
      digit: shortcutDigit(i.shortcut)!,
      href: i.href,
    }));
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;
      if (!/^[0-9]$/.test(e.key)) return;
      const digit = Number(e.key);
      const hit = bindings.find((b) => b.digit === digit);
      if (!hit) return;
      e.preventDefault();
      router.push(hit.href);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}
