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
    styleNotes:
      'clean studio product photograph, seamless light-grey paper backdrop, soft diffused key light with gentle fill, subtle contact shadow, centered hero framing, 50mm lens, crisp focus edge to edge, ecommerce ready, no props',
    defaultOn: true,
  },
  'studio-dark': {
    id: 'studio-dark',
    label: 'studio · moody',
    group: 'studio',
    styleNotes:
      'dramatic studio product photograph, deep charcoal gradient backdrop, single hard rim light plus soft fill, controlled specular highlights, moody low-key mood, 85mm lens, sharp product detail, premium look',
    defaultOn: false,
  },
  'lifestyle-kitchen': {
    id: 'lifestyle-kitchen',
    label: 'lifestyle · kitchen',
    group: 'lifestyle',
    styleNotes:
      'lifestyle product photograph on a warm wooden kitchen counter, soft natural window daylight, a hand reaching for the product, shallow depth of field, candid editorial framing, realistic textures',
    defaultOn: true,
  },
  'lifestyle-market': {
    id: 'lifestyle-market',
    label: 'lifestyle · market',
    group: 'lifestyle',
    styleNotes:
      'lifestyle product photograph at an outdoor farmers market, wooden crates and fresh produce around the product, bright directional sunlight, contextual placement, 35mm reportage feel, natural color',
    defaultOn: false,
  },
  'lifestyle-handheld': {
    id: 'lifestyle-handheld',
    label: 'lifestyle · in-use',
    group: 'lifestyle',
    styleNotes: 'lifestyle product photograph of the product held in use, hands in frame, blurred everyday background, shallow depth of field, natural daylight, authentic editorial moment',
    defaultOn: true,
  },
  'lifestyle-flatlay': {
    id: 'lifestyle-flatlay',
    label: 'lifestyle · flatlay',
    group: 'lifestyle',
    styleNotes: 'overhead flatlay product photograph, the product centered on a linen surface with complementary props arranged around it, even soft daylight from above, balanced negative space, top-down 90-degree angle',
    defaultOn: false,
  },
  'hero-wide': {
    id: 'hero-wide',
    label: 'hero · web',
    group: 'hero',
    styleNotes:
      'wide cinematic hero product photograph, the product anchored to one side with generous negative space for copy on the other, soft cinematic key light, gentle gradient backdrop, shallow depth of field, banner-ready composition',
    defaultOn: true,
  },
};

export function isPhotoshootTemplateId(value: string): value is PhotoshootTemplateId {
  return value in PHOTOSHOOT_TEMPLATES;
}

/**
 * Returns a curated subset of template ids to show in the "recommended" group —
 * one representative per group: studio, lifestyle, hero.
 */
export function recommendedTemplateIds(): PhotoshootTemplateId[] {
  return ['studio-clean', 'lifestyle-handheld', 'hero-wide'];
}

export type PhotoshootBrief = {
  productName: string;
  productNotes: string;
  ratio: PhotoshootRatio;
  variantsPerTemplate: number;
  templateIds: PhotoshootTemplateId[];
};
