import { describe, expect, it } from 'vitest';
import { resolveCommit } from './inlineEdit';

describe('resolveCommit', () => {
  it('commits a trimmed changed value', () => {
    expect(resolveCommit('  New title  ', 'Old title')).toEqual({
      commit: true,
      value: 'New title',
    });
  });

  it('does not commit when the trimmed value equals the current value', () => {
    expect(resolveCommit('  Same  ', 'Same')).toEqual({ commit: false, value: 'Same' });
  });

  it('reverts an empty value when allowEmpty is false (default)', () => {
    expect(resolveCommit('   ', 'Keep me')).toEqual({ commit: false, value: 'Keep me' });
  });

  it('commits an empty value when allowEmpty is true and current is non-empty', () => {
    expect(resolveCommit('   ', 'Had text', { allowEmpty: true })).toEqual({
      commit: true,
      value: '',
    });
  });

  it('does not commit an already-empty value even when allowEmpty is true', () => {
    expect(resolveCommit('  ', '', { allowEmpty: true })).toEqual({ commit: false, value: '' });
  });

  it('preserves internal whitespace and newlines for multiline values', () => {
    expect(resolveCommit('  line one\nline two  ', 'old', { allowEmpty: true })).toEqual({
      commit: true,
      value: 'line one\nline two',
    });
  });
});
