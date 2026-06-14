import type { BrandProfile } from './brand';
import type { Campaign, CampaignTile } from './campaigns';
import type { VitrineImageGenInput } from './imageGenBody';
import {
  buildCampaignPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from './promptBuilder';
import { PRESETS } from './presets';

export type RegenOptions = {
  /** Fix-layout: re-edit the tile's current image instead of the product refs. */
  relayout?: boolean;
  promptHint?: string;
  /** Override the brand palette for this generation only. */
  paletteOverride?: string[];
  /** Brand logo url; included in images[] + prompt when includeLogo is true. */
  logoUrl?: string | null;
  includeLogo?: boolean;
  /** Variation seed appended to the prompt. Omit/null for estimates (cost identical). */
  variation?: number | null;
};

function isEnhancedPrompt(value: unknown): value is EnhancedPrompt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.finalPrompt === 'string' && typeof v.aspectRatio === 'string';
}

export function buildTileRegenInput(args: {
  campaign: Pick<Campaign, 'brief' | 'enhancedPrompts'>;
  tile: Pick<CampaignTile, 'presetId' | 'adCopy' | 'quantity' | 'assetUrl'>;
  brand: BrandProfile | null;
  refUrls: string[];
  variantsPerPreset: number;
  options: RegenOptions;
}): { input: VitrineImageGenInput; prompt: string } {
  const { campaign, tile, brand, refUrls, variantsPerPreset, options } = args;
  const preset = PRESETS[tile.presetId];

  // Apply palette override without mutating the source brand.
  const effectiveBrand: BrandProfile | null =
    brand && options.paletteOverride
      ? { ...brand, palette: options.paletteOverride }
      : brand;

  // Fix-layout edits the existing creative; plain regen uses the product refs.
  const baseEditImages = options.relayout && tile.assetUrl ? [tile.assetUrl] : refUrls;
  const editImages =
    options.includeLogo && options.logoUrl
      ? [...baseEditImages, options.logoUrl]
      : baseEditImages;

  // Rebuild the prompt whenever copy / palette / logo can influence it; only fall
  // back to the persisted enhanced prompt for a plain, override-free variation.
  const mustRebuild = !!tile.adCopy || !!options.paletteOverride || !!options.includeLogo;
  const persisted = campaign.enhancedPrompts?.[tile.presetId];
  const enhanced: EnhancedPrompt = mustRebuild
    ? buildCampaignPrompt({
        brief: campaign.brief,
        brand: effectiveBrand,
        preset,
        referenceCount: editImages.length,
        ...(tile.adCopy ? { adCopy: tile.adCopy } : {}),
        ...(options.includeLogo ? { logo: true } : {}),
      })
    : isEnhancedPrompt(persisted)
      ? persisted
      : buildCampaignPrompt({
          brief: campaign.brief,
          brand: effectiveBrand,
          preset,
          referenceCount: editImages.length,
        });

  const basePrompt = resolveFinalPrompt(enhanced);
  const withHint = options.promptHint ? `${basePrompt}\n\n${options.promptHint}` : basePrompt;
  const prompt =
    options.variation === null || options.variation === undefined
      ? withHint
      : `${withHint} · variation ${options.variation}`;

  const quantity = tile.quantity ?? variantsPerPreset ?? 1;

  const input: VitrineImageGenInput = {
    prompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: quantity,
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(editImages.length > 0 ? { images: editImages } : {}),
  };

  return { input, prompt };
}
