import type { AdCopy } from '../../src/lib/adCopy';
import type { BrandProfile } from '../../src/lib/brand';
import type { BriefForPresets } from '../../src/lib/presets';

export type LabFixture = {
  brief: BriefForPresets;
  brand: BrandProfile;
  adCopy: AdCopy;
  /** Optional reference image URLs (product hero). */
  refs?: string[];
};

/** Fill the BrandProfile fields the prompt builder ignores with stable defaults. */
function brand(
  partial: Pick<BrandProfile, 'name'> &
    Partial<Pick<BrandProfile, 'industry' | 'tone' | 'tagline' | 'palette'>>,
): BrandProfile {
  return {
    id: 'fixture',
    userId: 'fixture',
    name: partial.name,
    description: null,
    sourceUrl: null,
    palette: partial.palette ?? [],
    tone: partial.tone ?? null,
    industry: partial.industry ?? null,
    tagline: partial.tagline ?? null,
    font: null,
    logoUrl: null,
    values: [],
    aesthetic: [],
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

export const BRIEFS: Record<string, LabFixture> = {
  skincare: {
    brief: {
      title: 'Lumen serum launch',
      description: 'A minimalist vitamin-C face serum in a frosted glass dropper bottle.',
      goal: 'drive first-purchase trials of the new serum',
      offer: '20% off the launch bundle',
      prompt: 'frosted glass serum bottle on a wet stone surface, soft morning light',
      audience: 'skincare-curious millennials',
      aesthetics: 'clean, dewy, editorial, lots of negative space',
    },
    brand: brand({
      name: 'Lumen',
      industry: 'skincare',
      tone: 'calm, premium, science-led',
      tagline: 'clarity, bottled.',
      palette: ['#0F1B2B', '#E8F0EF', '#C8A24B'],
    }),
    adCopy: {
      headline: 'CLARITY, BOTTLED',
      subhead: 'A vitamin-C serum that wakes your skin up.',
      cta: 'Shop the launch',
    },
  },
  coffee: {
    brief: {
      title: 'Ember cold brew',
      description: 'A matte-black canned cold brew with a bold amber label.',
      goal: 'build awareness for the new ready-to-drink can',
      offer: 'free can with your first subscription box',
      prompt: 'matte black coffee can on concrete, dramatic side light, condensation',
      audience: 'urban commuters who want craft coffee fast',
      aesthetics: 'bold, high-contrast, industrial, energetic',
    },
    brand: brand({
      name: 'Ember',
      industry: 'beverage',
      tone: 'bold, punchy, confident',
      tagline: 'cold brew, lit.',
      palette: ['#111111', '#F4A024', '#E7E2D8'],
    }),
    adCopy: {
      headline: 'COLD BREW, LIT',
      subhead: 'Craft cold brew in a can. No line, no wait.',
      cta: 'Get a can',
    },
  },
};
