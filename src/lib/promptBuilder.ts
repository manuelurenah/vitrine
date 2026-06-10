import type { AdCopy } from './adCopy';
import type { BrandProfile } from './brand';
import type { PhotoshootBrief, PhotoshootRatio, PhotoshootTemplate } from './photoshootTemplates';
import type { BriefForPresets, PresetDef } from './presets';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

export type EnhancedPrompt = {
  base: string;
  brandLayer: string;
  styleLayer: string;
  finalPrompt: string;
  negativePrompt: string;
  aspectRatio: AspectRatio;
  userOverride?: string;
};

const DEFAULT_NEGATIVE =
  'low quality, watermark, text overlay, distorted product, extra fingers, blurry';
const CAMPAIGN_TEXT_NEGATIVE =
  'low quality, watermark, distorted product, extra fingers, blurry, gibberish text, misspelled text, duplicate text';

const RATIO_FALLBACK: Record<string, AspectRatio> = {
  '1:1': '1:1',
  '4:5': '4:5',
  '5:4': '4:5',
  '9:16': '9:16',
  '16:9': '16:9',
  '1.91:1': '16:9',
  '1.91': '16:9',
};

function presetAspect(preset: PresetDef): AspectRatio {
  const direct = RATIO_FALLBACK[preset.ratio];
  if (direct) return direct;
  const r = preset.width / preset.height;
  if (Math.abs(r - 1) < 0.05) return '1:1';
  if (r > 1.5) return '16:9';
  if (r >= 0.7) return '4:5';
  return '9:16';
}

function brandLayer(brand: BrandProfile | null | undefined): string {
  if (!brand) return '';
  const parts: string[] = [];
  if (brand.name) parts.push(`brand: ${brand.name}`);
  if (brand.industry) parts.push(`industry: ${brand.industry}`);
  if (brand.tone) parts.push(`tone: ${brand.tone}`);
  if (brand.tagline) parts.push(`tagline: "${brand.tagline}"`);
  const palette = (brand.palette ?? []).slice(0, 3).filter(Boolean);
  if (palette.length) parts.push(`palette accents: ${palette.join(', ')}`);
  const layer = parts.join('. ').trim();
  if (!layer) return '';
  return layer.length > 200 ? `${layer.slice(0, 197)}...` : layer;
}

function referenceLayer(count: number): string {
  if (count <= 0) return '';
  if (count === 1) {
    return 'use the attached reference image as the visual basis for the product hero — preserve product fidelity, silhouette, label legibility, and material accuracy';
  }
  return `use the attached ${count} reference images as the visual basis for the product hero — preserve product fidelity, silhouette, label legibility, and material accuracy across the set`;
}

function assemble(parts: Array<string | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('. ')
    .replace(/\.\s*\.+/g, '.');
}

export type BuildCampaignPromptInput = {
  brief: BriefForPresets;
  brand?: BrandProfile | null;
  preset: PresetDef;
  referenceCount?: number;
  userOverride?: string;
  adCopy?: AdCopy | null;
};

function copyPlacement(preset: PresetDef): string {
  const r = preset.width / preset.height;
  if (r > 1.4) return 'left third of the frame';
  if (r < 0.7) return 'upper third with negative space below for the subject';
  return 'upper half with the subject anchoring the lower half';
}

function copyLayer(preset: PresetDef, adCopy: AdCopy): string {
  const placement = copyPlacement(preset);
  const parts: string[] = [];
  parts.push(
    `this is a finished social advertising creative — composition, lighting, and layout must support the overlaid sales message`,
  );
  parts.push(
    `render the headline "${adCopy.headline}" in the ${placement}, large bold sans-serif uppercase, clean kerning, high-contrast over a subtle dark gradient or solid shape for legibility, no typos`,
  );
  parts.push(
    `directly beneath, set the subhead "${adCopy.subhead}" in a smaller medium-weight sans-serif, sentence case, two lines max`,
  );
  if (adCopy.cta) {
    parts.push(
      `near the lower-right corner, render a solid rounded-pill button containing the text "${adCopy.cta}" in bold sans-serif, clearly readable, brand-accent fill`,
    );
  }
  parts.push(
    'all rendered text must be perfectly spelled, sharp, evenly kerned, and grammatically intact; absolutely no extra, garbled, or duplicate words; no lorem ipsum',
  );
  return parts.join('. ');
}

export function buildCampaignPrompt(input: BuildCampaignPromptInput): EnhancedPrompt {
  const { brief, brand, preset, referenceCount = 0, userOverride, adCopy } = input;

  const baseDescription = (brief.description?.trim() || brief.prompt?.trim() || '').replace(
    /\s+/g,
    ' ',
  );
  const base = assemble([
    baseDescription,
    brief.goal ? `goal: ${brief.goal}` : undefined,
    brief.offer ? `offer: ${brief.offer}` : undefined,
    brief.audience ? `audience: ${brief.audience}` : undefined,
    brief.aesthetics ? `aesthetic: ${brief.aesthetics}` : undefined,
  ]);

  const brandStr = brandLayer(brand ?? null);
  const refStr = referenceLayer(referenceCount);
  const hasCopy = !!adCopy && !!adCopy.headline && !!adCopy.subhead;
  const intentStr = hasCopy
    ? `social advertising creative for a ${preset.label} ${preset.ratio} placement, designed to be posted as-is — the product is the hero subject and the overlaid headline, subhead, and CTA carry the sales message`
    : `social media creative for a ${preset.label} ${preset.ratio} placement — the product is the hero subject`;
  const styleStr = hasCopy
    ? `${preset.styleNotes}. on-brand, product-forward, polished ad creative, high quality, commercial-grade composition`
    : `${preset.styleNotes}. on-brand, product-forward, no text overlay, high quality`;
  const copyStr = hasCopy ? copyLayer(preset, adCopy) : '';

  const finalPrompt = assemble([intentStr, base, brandStr, refStr, styleStr, copyStr]);

  return {
    base,
    brandLayer: brandStr,
    styleLayer: styleStr,
    finalPrompt,
    negativePrompt: hasCopy ? CAMPAIGN_TEXT_NEGATIVE : DEFAULT_NEGATIVE,
    aspectRatio: presetAspect(preset),
    userOverride: userOverride && userOverride.trim() ? userOverride.trim() : undefined,
  };
}

export type BuildPhotoshootPromptInput = {
  brief: PhotoshootBrief;
  brand?: BrandProfile | null;
  template: PhotoshootTemplate;
  ratio?: PhotoshootRatio;
  referenceCount?: number;
  userOverride?: string;
};

export function buildPhotoshootPrompt(input: BuildPhotoshootPromptInput): EnhancedPrompt {
  const { brief, brand, template, referenceCount = 0, userOverride } = input;
  const ratio: PhotoshootRatio = input.ratio ?? brief.ratio;

  const base = assemble([
    brief.productName ? `product: ${brief.productName}` : undefined,
    brief.productNotes?.trim() || undefined,
  ]);

  const brandStr = brandLayer(brand ?? null);
  const refStr = referenceLayer(referenceCount);
  const styleStr = `${template.styleNotes}. no overlay text, product accurate, photo-real`;

  const finalPrompt = assemble([base, brandStr, refStr, styleStr]);

  return {
    base,
    brandLayer: brandStr,
    styleLayer: styleStr,
    finalPrompt,
    negativePrompt: DEFAULT_NEGATIVE,
    aspectRatio: ratio,
    userOverride: userOverride && userOverride.trim() ? userOverride.trim() : undefined,
  };
}

export function resolveFinalPrompt(enhanced: EnhancedPrompt): string {
  return enhanced.userOverride && enhanced.userOverride.trim()
    ? enhanced.userOverride.trim()
    : enhanced.finalPrompt;
}
