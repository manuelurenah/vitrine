import { describe, expect, it } from 'vitest';
import {
  asMotionPref,
  asThemePref,
  MOTION_PREFS,
  reducedMotionFor,
  resolveTheme,
  THEME_PREFS,
} from './preferences';

describe('resolveTheme', () => {
  it('returns explicit light/dark unchanged regardless of system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('resolves system from systemPrefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('reducedMotionFor', () => {
  it('maps each pref to its MotionConfig value', () => {
    expect(reducedMotionFor('system')).toBe('user');
    expect(reducedMotionFor('reduced')).toBe('always');
    expect(reducedMotionFor('full')).toBe('never');
  });
});

describe('asThemePref', () => {
  it('passes through valid values', () => {
    expect(asThemePref('system')).toBe('system');
    expect(asThemePref('light')).toBe('light');
    expect(asThemePref('dark')).toBe('dark');
  });
  it('falls back to system for null or junk', () => {
    expect(asThemePref(null)).toBe('system');
    expect(asThemePref('purple')).toBe('system');
  });
});

describe('asMotionPref', () => {
  it('passes through valid values', () => {
    expect(asMotionPref('system')).toBe('system');
    expect(asMotionPref('reduced')).toBe('reduced');
    expect(asMotionPref('full')).toBe('full');
  });
  it('falls back to system for null or junk', () => {
    expect(asMotionPref(null)).toBe('system');
    expect(asMotionPref('slow')).toBe('system');
  });
});

describe('pref lists', () => {
  it('expose the full option sets in display order', () => {
    expect(THEME_PREFS).toEqual(['system', 'light', 'dark']);
    expect(MOTION_PREFS).toEqual(['system', 'reduced', 'full']);
  });
});
