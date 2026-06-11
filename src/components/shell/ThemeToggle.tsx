'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui';

const STORAGE_KEY = 'vitrine-theme';

type Theme = 'dark' | 'light';

function getAppliedTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — still apply visually
  }
}

export function ThemeToggle() {
  // Initialise to null so the button only renders once the DOM state is known,
  // avoiding any flash of the wrong icon during hydration.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Read the DOM (already set by the inline no-flash script) rather than
    // localStorage, so the icon always reflects what the user sees.
    setTheme(getAppliedTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setTheme(next);
  }

  // Don't render until the client has read the DOM — keeps icon in sync with
  // the theme the inline script already applied (no hydration mismatch).
  if (theme === null) return null;

  const isLight = theme === 'light';

  return (
    <IconButton
      variant="secondary"
      aria-label={isLight ? 'switch to dark theme' : 'switch to light theme'}
      aria-pressed={isLight}
      icon={isLight ? <Moon size={16} strokeWidth={1.75} /> : <Sun size={16} strokeWidth={1.75} />}
      onClick={toggle}
    />
  );
}
