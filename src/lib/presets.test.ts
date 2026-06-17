import { describe, expect, it } from 'vitest';
import { isAdPreset, isPresetId, PRESET_PLATFORMS, PRESETS, type PresetId } from './presets';

const AD_PRESET_IDS: PresetId[] = [
  'ad-footer-320x50',
  'ad-leaderboard-728x90',
  'ad-leaderboard-970x90',
  'ad-rectangle-300x250',
  'ad-billboard-970x250',
  'ad-skyscraper-300x600',
];

const EXPECTED: Record<
  string,
  { width: number; height: number; aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' }
> = {
  'ad-footer-320x50': { width: 320, height: 50, aspectRatio: '16:9' },
  'ad-leaderboard-728x90': { width: 728, height: 90, aspectRatio: '16:9' },
  'ad-leaderboard-970x90': { width: 970, height: 90, aspectRatio: '16:9' },
  'ad-billboard-970x250': { width: 970, height: 250, aspectRatio: '16:9' },
  'ad-rectangle-300x250': { width: 300, height: 250, aspectRatio: '1:1' },
  'ad-skyscraper-300x600': { width: 300, height: 600, aspectRatio: '9:16' },
};

describe('ad presets', () => {
  it('registers all 6 ad sizes with civitai-ads platform and exact dims', () => {
    for (const id of AD_PRESET_IDS) {
      const preset = PRESETS[id];
      const expected = EXPECTED[id]!;
      expect(preset, `missing preset ${id}`).toBeDefined();
      expect(preset.platform).toBe('civitai-ads');
      expect(preset.exact).toBe(true);
      expect(preset.width).toBe(expected.width);
      expect(preset.height).toBe(expected.height);
    }
  });

  it('maps each ad size to the correct explicit aspectRatio', () => {
    for (const id of AD_PRESET_IDS) {
      expect(PRESETS[id].aspectRatio, `wrong AR for ${id}`).toBe(EXPECTED[id]!.aspectRatio);
    }
  });

  it('isAdPreset is true for ad ids and false for social ids', () => {
    expect(isAdPreset('ad-rectangle-300x250')).toBe(true);
    expect(isAdPreset('ad-skyscraper-300x600')).toBe(true);
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
