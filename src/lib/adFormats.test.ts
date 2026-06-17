import { describe, expect, it } from 'vitest';
import {
  AD_FORMATS,
  AD_SIZE_LIST,
  AD_SIZES,
  isAdSizeId,
  nearestAspect,
  recommendedAdSizeIds,
} from './adFormats';

describe('nearestAspect', () => {
  it('maps each ad ratio to the closest allowed aspect ratio', () => {
    expect(nearestAspect(320, 50)).toBe('16:9');
    expect(nearestAspect(728, 90)).toBe('16:9');
    expect(nearestAspect(970, 90)).toBe('16:9');
    expect(nearestAspect(970, 250)).toBe('16:9');
    expect(nearestAspect(300, 250)).toBe('1:1'); // 1.2 is closer to 1:1 than 4:5
    expect(nearestAspect(300, 600)).toBe('9:16');
  });
});

describe('AD_FORMATS', () => {
  it('encodes the four request formats verbatim', () => {
    expect(AD_FORMATS.map((f) => f.name)).toEqual([
      'Footer',
      'Banner',
      'Rectangle',
      'Skyscraper',
    ]);
    const footer = AD_FORMATS.find((f) => f.name === 'Footer')!;
    expect(footer.sizes.mobile).toEqual([[320, 50]]);
    expect(footer.sizes.desktop).toEqual([
      [728, 90],
      [970, 90],
    ]);
  });
});

describe('AD_SIZES', () => {
  it('flattens to exactly six unique pixel sizes', () => {
    const dims = AD_SIZE_LIST.map((s) => `${s.width}x${s.height}`).sort();
    expect(dims).toEqual(['300x250', '300x600', '320x50', '728x90', '970x250', '970x90']);
  });

  it('tags a shared size with every format that uses it', () => {
    const rect = AD_SIZE_LIST.find((s) => s.width === 300 && s.height === 250)!;
    expect(rect.formats.sort()).toEqual(['Banner', 'Rectangle']);
    const leaderboard = AD_SIZE_LIST.find((s) => s.width === 728 && s.height === 90)!;
    expect(leaderboard.formats.sort()).toEqual(['Banner', 'Footer']);
  });

  it('assigns each size the nearest generation aspect ratio', () => {
    const lb = AD_SIZES[Object.keys(AD_SIZES).find((k) => AD_SIZES[k]!.width === 728)!]!;
    expect(lb.aspectRatio).toBe('16:9');
  });

  it('has stable ids that round-trip through isAdSizeId', () => {
    for (const s of AD_SIZE_LIST) expect(isAdSizeId(s.id)).toBe(true);
    expect(isAdSizeId('nope')).toBe(false);
  });
});

describe('recommendedAdSizeIds', () => {
  it('returns a non-empty subset of real size ids', () => {
    const rec = recommendedAdSizeIds();
    expect(rec.length).toBeGreaterThan(0);
    for (const id of rec) expect(isAdSizeId(id)).toBe(true);
  });
});
