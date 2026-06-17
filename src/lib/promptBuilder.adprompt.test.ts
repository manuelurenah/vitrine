import { describe, expect, it } from 'vitest';
import { AD_SIZES } from './adFormats';
import { buildAdPrompt } from './promptBuilder';

const leaderboard = AD_SIZES['leaderboard-728x90']!;
const rectangle = AD_SIZES['medium-rectangle-300x250']!;

const brief = {
  title: 'Spring sale',
  description: 'A bright bottle of cold brew on a kitchen counter',
  goal: 'drive signups',
  offer: '20% off',
  prompt: '',
};

describe('buildAdPrompt', () => {
  it('passes through the size aspect ratio for generation', () => {
    expect(buildAdPrompt({ brief, size: leaderboard }).aspectRatio).toBe('16:9');
    expect(buildAdPrompt({ brief, size: rectangle }).aspectRatio).toBe('1:1');
  });

  it('references the exact pixel size and crop-safe intent', () => {
    const p = buildAdPrompt({ brief, size: leaderboard }).finalPrompt.toLowerCase();
    expect(p).toContain('728');
    expect(p).toContain('90');
    expect(p).toContain('crop');
  });

  it('uses the no-text negative prompt when no ad copy is supplied', () => {
    const p = buildAdPrompt({ brief, size: rectangle });
    expect(p.negativePrompt).toContain('text overlay');
  });

  it('bakes ad copy and switches the negative prompt when copy is supplied', () => {
    const p = buildAdPrompt({
      brief,
      size: rectangle,
      adCopy: { headline: 'Cold brew, hot deal', subhead: 'Fresh every morning', cta: 'Shop now' },
    });
    expect(p.finalPrompt).toContain('Cold brew, hot deal');
    expect(p.negativePrompt).toContain('misspelled');
  });
});
