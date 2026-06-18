import { describe, expect, it } from 'vitest';
import {
  AD_STACK_COUNT,
  isAdPreset,
  isPresetId,
  isStackedPreset,
  PRESET_PLATFORMS,
  PRESETS,
  type PresetId,
  stackedAspect,
  stackedAspectRatio,
} from './presets';

const AD_PRESET_IDS: PresetId[] = [
  'ad-footer-320x50',
  'ad-leaderboard-728x90',
  'ad-leaderboard-970x90',
  'ad-rectangle-300x250',
  'ad-billboard-970x250',
  'ad-skyscraper-300x600',
];

// The four wide formats are now stacked 3-banner sheets (exact:false, stacked:true,
// no static aspectRatio). Rectangle + skyscraper stay exact-crop single creatives.
const STACKED_IDS: PresetId[] = [
  'ad-footer-320x50',
  'ad-leaderboard-728x90',
  'ad-leaderboard-970x90',
  'ad-billboard-970x250',
];
const EXACT_IDS: PresetId[] = ['ad-rectangle-300x250', 'ad-skyscraper-300x600'];

const EXACT_EXPECTED: Record<
  string,
  { width: number; height: number; aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '8:1' | '4:1' | '5:4' }
> = {
  'ad-rectangle-300x250': { width: 300, height: 250, aspectRatio: '5:4' },
  'ad-skyscraper-300x600': { width: 300, height: 600, aspectRatio: '9:16' },
};

const DIMS: Record<string, { width: number; height: number }> = {
  'ad-footer-320x50': { width: 320, height: 50 },
  'ad-leaderboard-728x90': { width: 728, height: 90 },
  'ad-leaderboard-970x90': { width: 970, height: 90 },
  'ad-billboard-970x250': { width: 970, height: 250 },
  'ad-rectangle-300x250': { width: 300, height: 250 },
  'ad-skyscraper-300x600': { width: 300, height: 600 },
};

describe('ad presets', () => {
  it('registers all 6 ad sizes with civitai-ads platform and correct dims', () => {
    for (const id of AD_PRESET_IDS) {
      const preset = PRESETS[id];
      expect(preset, `missing preset ${id}`).toBeDefined();
      expect(preset.platform).toBe('civitai-ads');
      expect(preset.width).toBe(DIMS[id]!.width);
      expect(preset.height).toBe(DIMS[id]!.height);
    }
  });

  it('the four wide formats are stacked sheets (stacked:true, exact:false, no static aspectRatio)', () => {
    for (const id of STACKED_IDS) {
      const preset = PRESETS[id];
      expect(preset.stacked, `${id} should be stacked`).toBe(true);
      expect(preset.exact, `${id} should not be exact-crop`).toBe(false);
      expect(preset.aspectRatio, `${id} should drop its static aspectRatio`).toBeUndefined();
    }
  });

  it('rectangle + skyscraper stay exact-crop single creatives with explicit aspectRatio', () => {
    for (const id of EXACT_IDS) {
      const preset = PRESETS[id];
      expect(preset.exact, `${id} should be exact`).toBe(true);
      expect(preset.stacked, `${id} should not be stacked`).toBeUndefined();
      expect(preset.aspectRatio, `wrong AR for ${id}`).toBe(EXACT_EXPECTED[id]!.aspectRatio);
    }
  });

  it('AD_STACK_COUNT is the constant 3', () => {
    expect(AD_STACK_COUNT).toBe(3);
  });

  it('isStackedPreset is true only for the four wide formats', () => {
    for (const id of STACKED_IDS) expect(isStackedPreset(id)).toBe(true);
    for (const id of EXACT_IDS) expect(isStackedPreset(id)).toBe(false);
    expect(isStackedPreset('ig-feed')).toBe(false);
  });

  it('stackedAspect at n=3 snaps each wide format to its nearest supported AR', () => {
    expect(stackedAspect(PRESETS['ad-footer-320x50'], 3)).toBe('16:9');
    expect(stackedAspect(PRESETS['ad-leaderboard-728x90'], 3)).toBe('16:9');
    expect(stackedAspect(PRESETS['ad-leaderboard-970x90'], 3)).toBe('4:1');
    expect(stackedAspect(PRESETS['ad-billboard-970x250'], 3)).toBe('5:4');
  });

  it('stackedAspectRatio returns the numeric ratio matching stackedAspect', () => {
    expect(stackedAspectRatio(PRESETS['ad-footer-320x50'], 3)).toBeCloseTo(16 / 9, 5);
    expect(stackedAspectRatio(PRESETS['ad-leaderboard-728x90'], 3)).toBeCloseTo(16 / 9, 5);
    expect(stackedAspectRatio(PRESETS['ad-leaderboard-970x90'], 3)).toBe(4);
    expect(stackedAspectRatio(PRESETS['ad-billboard-970x250'], 3)).toBe(1.25);
  });

  it('isAdPreset is true for ad ids and false for social ids', () => {
    expect(isAdPreset('ad-rectangle-300x250')).toBe(true);
    expect(isAdPreset('ad-skyscraper-300x600')).toBe(true);
    expect(isAdPreset('ad-billboard-970x250')).toBe(true);
    expect(isAdPreset('ig-feed')).toBe(false);
  });

  it('ad ids pass isPresetId (so briefSchema keeps them)', () => {
    for (const id of AD_PRESET_IDS) {
      expect(isPresetId(id)).toBe(true);
    }
  });
});

describe('social presets', () => {
  const SOCIAL_IDS: PresetId[] = ['ig-feed', 'ig-story', 'reels', 'tiktok', 'fb', 'li', 'x', 'yt'];

  it('all carry platform social and no exact/aspectRatio overrides', () => {
    for (const id of SOCIAL_IDS) {
      const preset = PRESETS[id];
      expect(preset.platform).toBe('social');
      expect(preset.exact).toBeUndefined();
      expect(preset.aspectRatio).toBeUndefined();
    }
  });
});

describe('PRESET_PLATFORMS', () => {
  it('exposes both platform groups in order', () => {
    expect(PRESET_PLATFORMS.map((p) => p.id)).toEqual(['social', 'civitai-ads']);
  });
});
