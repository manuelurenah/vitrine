import { describe, expect, it } from 'vitest';
import { diffArrived } from './diffArrived';

describe('diffArrived', () => {
  it('returns all ids when nothing has been seen', () => {
    expect(diffArrived(new Set(), ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns only ids not already seen, preserving order', () => {
    expect(diffArrived(new Set(['a', 'c']), ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
  });

  it('returns empty when every current id was already seen (steady-state poll)', () => {
    expect(diffArrived(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
  });

  it('ignores seen ids that are no longer current', () => {
    expect(diffArrived(new Set(['x']), ['a'])).toEqual(['a']);
  });
});
