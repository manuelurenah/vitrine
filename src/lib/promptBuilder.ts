import type { BriefForPresets, PresetDef } from './presets';
import type { PhotoshootBrief, PhotoshootRatio, PhotoshootTemplate } from './photoshootTemplates';
import type { BrandProfile } from './brand';

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

const DEFAULT_NEGATIVE = 'low quality, watermark, text overlay, distorted product, extra fingers, blurry';

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
    return 'composition reference provided — preserve product fidelity, silhouette, and label legibility';
  }
  return `composition references provided (${count} images) — preserve product fidelity, silhouette, and label legibility across the set`;
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
};

export function buildCampaignPrompt(input: BuildCampaignPromptInput): EnhancedPrompt {
  const { brief, brand, preset, referenceCount = 0, userOverride } = input;

  const baseDescription = (brief.description?.trim() || brief.prompt?.trim() || '').replace(/\s+/g, ' ');
  const base = assemble([
    baseDescription,
    brief.goal ? `goal: ${brief.goal}` : undefined,
    brief.offer ? `offer: ${brief.offer}` : undefined,
    brief.audience ? `audience: ${brief.audience}` : undefined,
    brief.aesthetics ? `aesthetic: ${brief.aesthetics}` : undefined,
  ]);

  const brandStr = brandLayer(brand ?? null);
  const refStr = referenceLayer(referenceCount);
  const styleStr = `${preset.styleNotes}. on-brand, product-forward, no text overlay, high quality`;

  const finalPrompt = assemble([base, brandStr, refStr, styleStr]);

  return {
    base,
    brandLayer: brandStr,
    styleLayer: styleStr,
    finalPrompt,
    negativePrompt: DEFAULT_NEGATIVE,
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
