import { describe, expect, it } from 'vitest';
import type { BrandProfile } from './brand';
import type { PhotoshootBrief } from './photoshootTemplates';
import { PHOTOSHOOT_TEMPLATES } from './photoshootTemplates';
import type { BriefForPresets } from './presets';
import { PRESETS } from './presets';
import { buildCampaignPrompt, buildPhotoshootPrompt, resolveFinalPrompt } from './promptBuilder';

const baseBrief: BriefForPresets = {
  title: 'Summer launch',
  description: 'Fresh strawberry sparkling water for outdoor afternoons.',
  goal: 'drive ig saves',
  offer: '15% off launch week',
  prompt: 'sparkling water can on picnic blanket',
  audience: 'gen-z foodies',
  aesthetics: 'warm pastel, soft grain',
};

const fullBrand: BrandProfile = {
  id: 'b1',
  userId: 'u1',
  name: 'Fizzly',
  description: 'craft sparkling',
  sourceUrl: null,
  palette: ['#ff6b9d', '#ffc56b', '#88e0c0', '#3399ff', '#000000'],
  tone: 'playful, confident',
  industry: 'beverage',
  tagline: 'sip something brighter',
  font: null,
  logoUrl: null,
  values: [],
  aesthetic: [],
  isDefault: true,
  createdAt: 0,
  updatedAt: 0,
};

const sparseBrand: BrandProfile = {
  ...fullBrand,
  description: null,
  palette: [],
  tone: null,
  tagline: null,
  industry: null,
};

const shoot: PhotoshootBrief = {
  productName: 'Strawberry Fizz Can',
  productNotes: 'matte pink can with embossed logo',
  ratio: '4:5',
  variantsPerTemplate: 1,
  templateIds: ['studio-clean'],
};

describe('buildCampaignPrompt', () => {
  it('assembles base + brand + style for fully populated brand', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: fullBrand,
      preset: PRESETS['ig-feed'],
    });
    expect(out.base).toContain('strawberry sparkling water');
    expect(out.brandLayer).toContain('Fizzly');
    expect(out.brandLayer).toContain('beverage');
    expect(out.brandLayer).toContain('sip something brighter');
    expect(out.brandLayer).toMatch(/#ff6b9d/);
    expect(out.styleLayer).toContain('editorial product photography');
    expect(out.finalPrompt).toContain('strawberry sparkling water');
    expect(out.finalPrompt).toContain('Fizzly');
    expect(out.finalPrompt).toContain('editorial product photography');
    expect(out.aspectRatio).toBe('4:5');
    expect(out.negativePrompt.length).toBeGreaterThan(0);
  });

  it('omits brand layer when brand is null', () => {
    const out = buildCampaignPrompt({ brief: baseBrief, brand: null, preset: PRESETS['ig-feed'] });
    expect(out.brandLayer).toBe('');
    expect(out.finalPrompt).not.toContain('brand:');
  });

  it('handles sparse brand (no tagline, no palette, no tone)', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: sparseBrand,
      preset: PRESETS['ig-feed'],
    });
    expect(out.brandLayer).toContain('Fizzly');
    expect(out.brandLayer).not.toContain('palette');
    expect(out.brandLayer).not.toContain('tagline');
  });

  it('caps brand layer near 200 chars', () => {
    const huge: BrandProfile = {
      ...fullBrand,
      name: 'A'.repeat(50),
      tone: 'B'.repeat(50),
      tagline: 'C'.repeat(80),
      industry: 'D'.repeat(50),
    };
    const out = buildCampaignPrompt({ brief: baseBrief, brand: huge, preset: PRESETS['ig-feed'] });
    expect(out.brandLayer.length).toBeLessThanOrEqual(200);
  });

  it('includes single-image reference layer when referenceCount=1', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: fullBrand,
      preset: PRESETS['ig-feed'],
      referenceCount: 1,
    });
    expect(out.finalPrompt).toContain('attached reference image');
  });

  it('uses plural reference layer when referenceCount>=2', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: fullBrand,
      preset: PRESETS['ig-feed'],
      referenceCount: 3,
    });
    expect(out.finalPrompt).toContain('attached 3 reference images');
  });

  it('omits reference layer when referenceCount=0', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: fullBrand,
      preset: PRESETS['ig-feed'],
    });
    expect(out.finalPrompt).not.toContain('reference');
  });

  it('userOverride is preserved on the enhanced prompt object and resolveFinalPrompt swaps it in', () => {
    const out = buildCampaignPrompt({
      brief: baseBrief,
      brand: fullBrand,
      preset: PRESETS['ig-feed'],
      userOverride: '  manual prompt text  ',
    });
    expect(out.userOverride).toBe('manual prompt text');
    expect(resolveFinalPrompt(out)).toBe('manual prompt text');
  });

  it('resolveFinalPrompt returns finalPrompt when override is absent or whitespace', () => {
    const a = buildCampaignPrompt({ brief: baseBrief, preset: PRESETS['ig-feed'] });
    expect(resolveFinalPrompt(a)).toBe(a.finalPrompt);
    const b = buildCampaignPrompt({
      brief: baseBrief,
      preset: PRESETS['ig-feed'],
      userOverride: '   ',
    });
    expect(resolveFinalPrompt(b)).toBe(b.finalPrompt);
  });

  it('maps preset ratio strings to nano-banana aspect ratios', () => {
    expect(buildCampaignPrompt({ brief: baseBrief, preset: PRESETS['ig-feed'] }).aspectRatio).toBe(
      '4:5',
    );
    expect(buildCampaignPrompt({ brief: baseBrief, preset: PRESETS['ig-story'] }).aspectRatio).toBe(
      '9:16',
    );
    expect(buildCampaignPrompt({ brief: baseBrief, preset: PRESETS.fb }).aspectRatio).toBe('16:9');
  });
});

describe('buildCampaignPrompt logo', () => {
  it('omits the logo directive by default', () => {
    const p = buildCampaignPrompt({ brief: baseBrief, preset: PRESETS['ig-feed'], referenceCount: 1 });
    expect(p.finalPrompt.toLowerCase()).not.toContain('brand logo');
  });

  it('adds the logo directive when logo is true', () => {
    const p = buildCampaignPrompt({
      brief: baseBrief,
      preset: PRESETS['ig-feed'],
      referenceCount: 1,
      logo: true,
    });
    expect(p.finalPrompt.toLowerCase()).toContain('brand logo');
  });
});

describe('buildPhotoshootPrompt', () => {
  it('builds prompt from product name + notes + template style', () => {
    const out = buildPhotoshootPrompt({
      brief: shoot,
      brand: fullBrand,
      template: PHOTOSHOOT_TEMPLATES['studio-clean'],
    });
    expect(out.base).toContain('product: Strawberry Fizz Can');
    expect(out.base).toContain('matte pink can');
    expect(out.styleLayer).toContain('seamless paper background');
    expect(out.brandLayer).toContain('Fizzly');
    expect(out.aspectRatio).toBe('4:5');
  });

  it('respects an explicit ratio override', () => {
    const out = buildPhotoshootPrompt({
      brief: { ...shoot, ratio: '9:16' },
      template: PHOTOSHOOT_TEMPLATES['lifestyle-kitchen'],
      ratio: '1:1',
    });
    expect(out.aspectRatio).toBe('1:1');
  });

  it('omits reference layer when 0 refs', () => {
    const out = buildPhotoshootPrompt({
      brief: shoot,
      template: PHOTOSHOOT_TEMPLATES['studio-clean'],
    });
    expect(out.finalPrompt).not.toContain('reference');
  });

  it('userOverride round-trips and resolveFinalPrompt picks it', () => {
    const out = buildPhotoshootPrompt({
      brief: shoot,
      template: PHOTOSHOOT_TEMPLATES['studio-clean'],
      userOverride: 'my exact prompt',
    });
    expect(resolveFinalPrompt(out)).toBe('my exact prompt');
  });
});
