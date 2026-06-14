import { describe, expect, it } from 'vitest';
import { buildTileRegenInput } from './regenerateInput';

const campaign = {
  brief: { title: 't', description: 'serum', goal: 'sales', offer: '', prompt: '' },
  enhancedPrompts: null,
} as never;
const tile = { presetId: 'ig-feed', adCopy: null, quantity: 3, assetUrl: 'https://img/live' } as never;
const brand = { name: 'Acme', palette: ['#111111'], logoUrl: 'https://img/logo' } as never;

describe('buildTileRegenInput', () => {
  it('uses the live image for relayout, product refs otherwise', () => {
    const relayout = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: { relayout: true } });
    expect(relayout.input.images).toEqual(['https://img/live']);
    const plain = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: {} });
    expect(plain.input.images).toEqual(['https://img/ref']);
  });
  it('appends the logo to images and the directive to the prompt when included', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: { includeLogo: true, logoUrl: 'https://img/logo' } });
    expect(r.input.images).toContain('https://img/logo');
    expect(r.prompt.toLowerCase()).toContain('brand logo');
  });
  it('injects the palette override into the prompt', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { paletteOverride: ['#ABCDEF'] } });
    expect(r.prompt).toContain('#ABCDEF');
  });
  it('omits the variation suffix when variation is null (estimate parity)', () => {
    const est = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { variation: null } });
    expect(est.prompt).not.toContain('variation');
    const sub = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { variation: 42 } });
    expect(sub.prompt).toContain('variation 42');
  });
  it('respects tile.quantity for numImages', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: {} });
    expect(r.input.numImages).toBe(3);
  });
});
