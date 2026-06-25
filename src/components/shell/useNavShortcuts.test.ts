import { describe, expect, it } from 'vitest';
import { shortcutDigit } from './nav';

describe('shortcutDigit', () => {
  it('parses the meta digit', () => {
    expect(shortcutDigit('⌘2')).toBe(2);
    expect(shortcutDigit('⌘3')).toBe(3);
  });
  it('returns null for labels without a trailing digit', () => {
    expect(shortcutDigit('⌘')).toBeNull();
    expect(shortcutDigit('')).toBeNull();
    expect(shortcutDigit(undefined as unknown as string)).toBeNull();
  });
});
