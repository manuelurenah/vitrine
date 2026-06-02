export type PhotoshootTemplateId =
  | 'studio-clean'
  | 'studio-dark'
  | 'lifestyle-kitchen'
  | 'lifestyle-market'
  | 'lifestyle-handheld'
  | 'lifestyle-flatlay'
  | 'hero-wide';

export type PhotoshootRatio = '1:1' | '4:5' | '9:16' | '16:9';

export type PhotoshootTemplate = {
  id: PhotoshootTemplateId;
  label: string;
  group: 'studio' | 'lifestyle' | 'hero';
  styleNotes: string;
  defaultOn: boolean;
};

export const PHOTOSHOOT_TEMPLATES: Record<PhotoshootTemplateId, PhotoshootTemplate> = {
  'studio-clean': {
    id: 'studio-clean',
    label: 'studio · clean',
    group: 'studio',
    styleNotes: 'studio product shot, seamless paper background, soft key light, ecommerce ready, no props',
    defaultOn: true,
  },
  'studio-dark': {
    id: 'studio-dark',
    label: 'studio · moody',
    group: 'studio',
    styleNotes: 'studio product shot, dark gradient background, dramatic side light, glossy highlights',
    defaultOn: false,
  },
  'lifestyle-kitchen': {
    id: 'lifestyle-kitchen',
    label: 'lifestyle · kitchen',
    group: 'lifestyle',
    styleNotes: 'lifestyle shot, warm kitchen counter, natural daylight, hand reaching for product, candid',
    defaultOn: true,
  },
  'lifestyle-market': {
    id: 'lifestyle-market',
    label: 'lifestyle · market',
    group: 'lifestyle',
    styleNotes: 'farmers market scene, wooden crates, bright sunlight, contextual product placement',
    defaultOn: false,
  },
  'lifestyle-handheld': {
    id: 'lifestyle-handheld',
    label: 'lifestyle · in-use',
    group: 'lifestyle',
    styleNotes: 'product being used, hands in frame, shallow depth of field, editorial feel',
    defaultOn: true,
  },
  'lifestyle-flatlay': {
    id: 'lifestyle-flatlay',
    label: 'lifestyle · flatlay',
    group: 'lifestyle',
    styleNotes: 'overhead flatlay, complementary ingredients, linen napkin, daylight from above',
    defaultOn: false,
  },
  'hero-wide': {
    id: 'hero-wide',
    label: 'hero · web',
    group: 'hero',
    styleNotes: 'wide hero composition, lots of negative space on the right for copy, cinematic light',
    defaultOn: true,
  },
};

export function isPhotoshootTemplateId(value: string): value is PhotoshootTemplateId {
  return value in PHOTOSHOOT_TEMPLATES;
}

export type PhotoshootBrief = {
  productName: string;
  productNotes: string;
  ratio: PhotoshootRatio;
  variantsPerTemplate: number;
  templateIds: PhotoshootTemplateId[];
};

