'use client';

import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  asMotionPref,
  asThemePref,
  MOTION_KEY,
  reducedMotionFor,
  resolveTheme,
  THEME_KEY,
  type MotionPref,
  type ThemePref,
} from '@/lib/preferences';

type PreferencesContextValue = {
  theme: ThemePref;
  reduceMotion: MotionPref;
  setTheme: (pref: ThemePref) => void;
  setReduceMotion: (pref: MotionPref) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(pref, systemPrefersDark());
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // SSR-safe defaults; reconciled from localStorage on mount.
  const [theme, setThemeState] = useState<ThemePref>('system');
  const [reduceMotion, setReduceMotionState] = useState<MotionPref>('system');

  // Hydrate persisted prefs once on mount.
  useEffect(() => {
    setThemeState(asThemePref(localStorage.getItem(THEME_KEY)));
    setReduceMotionState(asMotionPref(localStorage.getItem(MOTION_KEY)));
  }, []);

  // Keep data-theme correct; while on `system`, follow live OS scheme changes.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (pref: ThemePref) => {
    setThemeState(pref);
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      // localStorage unavailable (private mode / disabled) — keep in-memory only.
    }
    applyTheme(pref);
  };

  const setReduceMotion = (pref: MotionPref) => {
    setReduceMotionState(pref);
    try {
      localStorage.setItem(MOTION_KEY, pref);
    } catch {
      // localStorage unavailable — keep in-memory only.
    }
  };

  return (
    <PreferencesContext.Provider value={{ theme, reduceMotion, setTheme, setReduceMotion }}>
      <MotionConfig reducedMotion={reducedMotionFor(reduceMotion)}>{children}</MotionConfig>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
