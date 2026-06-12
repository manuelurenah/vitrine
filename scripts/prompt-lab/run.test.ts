import { describe, expect, it } from 'vitest';
import { parseArgs } from './run';

describe('parseArgs', () => {
  it('applies defaults', () => {
    const o = parseArgs([]);
    expect(o.brief).toBe('skincare');
    expect(o.presets).toEqual(['ig-feed']);
    expect(o.num).toBe(1);
    expect(o.matrix).toBe(false);
    expect(o.refs).toEqual([]);
  });

  it('parses presets as a comma list', () => {
    expect(parseArgs(['--preset', 'ig-feed,ig-story']).presets).toEqual(['ig-feed', 'ig-story']);
  });

  it('parses refs, num, brief, overrides, and matrix', () => {
    const o = parseArgs([
      '--brief', 'coffee',
      '--refs', 'https://a/1.png,https://b/2.png',
      '--num', '3',
      '--matrix',
      '--prompt-override', 'raw prompt',
      '--negative-override', 'raw negative',
    ]);
    expect(o.brief).toBe('coffee');
    expect(o.refs).toEqual(['https://a/1.png', 'https://b/2.png']);
    expect(o.num).toBe(3);
    expect(o.matrix).toBe(true);
    expect(o.promptOverride).toBe('raw prompt');
    expect(o.negativeOverride).toBe('raw negative');
  });

  it('rejects an unknown preset id', () => {
    expect(() => parseArgs(['--preset', 'nope'])).toThrow(/unknown preset/i);
  });
});
