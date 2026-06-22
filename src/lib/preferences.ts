export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

export const THEME_KEY = 'vitrine-theme';
export const MOTION_KEY = 'vitrine-reduce-motion';

export const THEME_PREFS = ['system', 'light', 'dark'] as const satisfies readonly ThemePref[];
export const MOTION_PREFS = ['system', 'reduced', 'full'] as const satisfies readonly MotionPref[];

/** Resolved theme written to documentElement.dataset.theme. */
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Maps a motion pref to MotionConfig's `reducedMotion` prop. */
export function reducedMotionFor(pref: MotionPref): 'user' | 'always' | 'never' {
  switch (pref) {
    case 'reduced':
      return 'always';
    case 'full':
      return 'never';
    default:
      return 'user';
  }
}

/** Narrow an untrusted localStorage string to a ThemePref (fallback: system). */
export function asThemePref(v: string | null): ThemePref {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

/** Narrow an untrusted localStorage string to a MotionPref (fallback: system). */
export function asMotionPref(v: string | null): MotionPref {
  return v === 'reduced' || v === 'full' || v === 'system' ? v : 'system';
}
