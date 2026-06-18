import type { AdCopy } from './adCopy';
import type { BrandProfile } from './brand';
import type { PhotoshootBrief, PhotoshootRatio, PhotoshootTemplate } from './photoshootTemplates';
import { stackedAspect } from './presets';
import type { BriefForPresets, PresetDef } from './presets';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '8:1' | '4:1' | '5:4';

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
  if (preset.aspectRatio) return preset.aspectRatio;
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

/**
 * A composition archetype for the "fix layout" action. Each variant relocates
 * the headline, subject, and CTA into a deliberately different arrangement than
 * the default centered-hero / headline-top / CTA-lower-right layout, so a
 * re-layout produces a genuinely new composition rather than a restyle.
 */
export type LayoutVariant = {
  id: string;
  /** Where the headline + subhead block sits. */
  headline: string;
  /** Where the CTA button sits. */
  cta: string;
  /** Overall composition note — subject placement + negative space. */
  note: string;
};

export const LAYOUT_VARIANTS: LayoutVariant[] = [
  {
    id: 'split-left',
    headline: 'the left half, vertically centered',
    cta: 'the bottom-left, directly under the copy column',
    note: 'place the product/subject in the right half; reserve the left half as a clean copy column',
  },
  {
    id: 'banner-bottom',
    headline: 'the lower third as a bold banner band',
    cta: 'the bottom-right corner inside the banner band',
    note: 'let the subject fill the upper two-thirds; anchor all copy in a banner across the bottom',
  },
  {
    id: 'corner-top-right',
    headline: 'a compact block in the top-right corner',
    cta: 'just beneath the headline block, still top-right',
    note: 'anchor the subject to the lower-left; cluster the copy in the top-right with breathing room',
  },
  {
    id: 'overlay-center',
    headline: 'centered across the middle over a soft translucent scrim',
    cta: 'centered along the bottom edge',
    note: 'frame the subject behind a centered copy overlay rather than beside it',
  },
  {
    id: 'side-right',
    headline: 'a vertical column down the right edge',
    cta: 'the bottom-right, below the column',
    note: 'place the subject across the left two-thirds; run the copy as a tall right-hand column',
  },
];

export type BuildCampaignPromptInput = {
  brief: BriefForPresets;
  brand?: BrandProfile | null;
  preset: PresetDef;
  referenceCount?: number;
  userOverride?: string;
  adCopy?: AdCopy | null;
  /** When true, instruct the model to incorporate the supplied brand logo. */
  logo?: boolean;
  /** Re-layout into this composition archetype (fix-layout). Omit for the default placement. */
  layoutVariant?: LayoutVariant | null;
  /**
   * For `stacked` presets: render a single image stacking this many distinct
   * banner variations top-to-bottom at the stacked aspect ratio. Omit (or <2)
   * for normal single-creative behavior.
   */
  stackCount?: number;
};

function copyPlacement(preset: PresetDef): string {
  const r = preset.width / preset.height;
  if (r > 1.4) return 'left third of the frame';
  if (r < 0.7) return 'upper third with negative space below for the subject';
  return 'upper half with the subject anchoring the lower half';
}

function copyLayer(preset: PresetDef, adCopy: AdCopy, layout?: LayoutVariant): string {
  const placement = layout ? layout.headline : copyPlacement(preset);
  const ctaPlacement = layout ? layout.cta : 'near the lower-right corner';
  const parts: string[] = [];
  if (layout) {
    parts.push(
      `compose a fresh, intentional layout — ${layout.note}; do NOT default to a centered hero with the headline across the top`,
    );
  }
  parts.push(
    `this is a finished social advertising creative — composition, lighting, and layout must support the overlaid sales message`,
  );
  parts.push(
    `render the headline "${adCopy.headline}" in ${placement}, large bold sans-serif uppercase, clean kerning, high-contrast over a subtle dark gradient or solid shape for legibility, no typos`,
  );
  parts.push(
    `set the subhead "${adCopy.subhead}" adjacent to the headline in a smaller medium-weight sans-serif, sentence case, two lines max`,
  );
  if (adCopy.cta) {
    parts.push(
      `at ${ctaPlacement}, render a solid rounded-pill button containing the text "${adCopy.cta}" in bold sans-serif, clearly readable, brand-accent fill`,
    );
  }
  parts.push(
    'all rendered text must be perfectly spelled, sharp, evenly kerned, and grammatically intact; absolutely no extra, garbled, or duplicate words; no lorem ipsum',
  );
  return parts.join('. ');
}

function logoLayer(): string {
  return 'incorporate the supplied brand logo as a small mark in a corner, preserving its exact shape, proportions, and colors; do not distort or restyle it';
}

function stackedIntent(preset: PresetDef, stackCount: number): string {
  return (
    `a single advertising image containing ${stackCount} distinct variations of a ` +
    `${preset.width}×${preset.height}px ${preset.label} banner, arranged as ${stackCount} ` +
    `equal-height horizontal banners stacked top-to-bottom, edge-to-edge with no outer margin ` +
    `or gaps; each banner is a complete standalone ad with the brand, a short headline, and a ` +
    `CTA; make all text large, crisp, sharp, and perfectly legible; vary the copy, color, and ` +
    `layout across the ${stackCount} banners`
  );
}

export function buildCampaignPrompt(input: BuildCampaignPromptInput): EnhancedPrompt {
  const {
    brief,
    brand,
    preset,
    referenceCount = 0,
    userOverride,
    adCopy,
    logo,
    layoutVariant,
    stackCount,
  } = input;

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
  const isAd = preset.platform === 'civitai-ads';
  // Stacked presets render a multi-banner sheet at a supported AR instead of a
  // single exact-crop creative. The stacked intent + AR override the normal ad
  // intent and the per-preset aspect ratio.
  const isStacked = !!preset.stacked && typeof stackCount === 'number' && stackCount >= 2;
  const intentStr = isStacked
    ? stackedIntent(preset, stackCount)
    : isAd
      ? `digital advertising creative for a ${preset.width}×${preset.height}px Civitai ad placement, designed to be center-cropped to exactly ${preset.width}×${preset.height}px — keep the product hero and any text within the central safe area`
      : hasCopy
        ? `social advertising creative for a ${preset.label} ${preset.ratio} placement, designed to be posted as-is — the product is the hero subject and the overlaid headline, subhead, and CTA carry the sales message`
        : `social media creative for a ${preset.label} ${preset.ratio} placement — the product is the hero subject`;
  const styleStr = hasCopy
    ? `${preset.styleNotes}. on-brand, product-forward, polished ad creative, high quality, commercial-grade composition`
    : `${preset.styleNotes}. on-brand, product-forward, no text overlay, high quality`;
  const copyStr = hasCopy ? copyLayer(preset, adCopy, layoutVariant ?? undefined) : '';
  const logoStr = logo ? logoLayer() : '';

  const finalPrompt = assemble([intentStr, base, brandStr, refStr, styleStr, copyStr, logoStr]);

  return {
    base,
    brandLayer: brandStr,
    styleLayer: styleStr,
    finalPrompt,
    negativePrompt: hasCopy ? CAMPAIGN_TEXT_NEGATIVE : DEFAULT_NEGATIVE,
    aspectRatio: isStacked ? stackedAspect(preset, stackCount) : presetAspect(preset),
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
