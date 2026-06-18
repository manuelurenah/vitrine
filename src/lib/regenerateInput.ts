import type { AdCopy } from './adCopy';
import type { BrandProfile } from './brand';
import type { Campaign, CampaignTile } from './campaigns';
import type { VitrineImageGenInput } from './imageGenBody';
import {
  buildCampaignPrompt,
  type EnhancedPrompt,
  type LayoutVariant,
  resolveFinalPrompt,
} from './promptBuilder';
import { AD_STACK_COUNT, isAdPreset, isStackedPreset, PRESETS } from './presets';

export type RegenOptions = {
  /**
   * Fix-layout flag. The composition is always rebuilt from the product
   * references (never the finished creative) so the model is free to re-arrange;
   * pair with {@link RegenOptions.layoutVariant} to steer the new arrangement.
   */
  relayout?: boolean;
  /** Re-layout into this composition archetype (chosen per fix-layout click). */
  layoutVariant?: LayoutVariant | null;
  promptHint?: string;
  /** Override the brand palette for this generation only. */
  paletteOverride?: string[];
  /**
   * Ad copy to render this generation with, overriding the tile's persisted
   * copy. Used by the editor's "save" action so edited headline/subhead/cta are
   * applied in the same orchestrator call that renders the version.
   */
  adCopyOverride?: AdCopy | null;
  /**
   * Full prompt the user typed in the editor's background field. When present it
   * replaces the assembled prompt as the base (the brand-built prompt is still
   * used for aspect ratio + negative prompt).
   */
  promptOverride?: string;
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

  // Always compose from the product references — feeding the finished creative
  // back in makes the edit model preserve the layout (it only restyles). Letting
  // it build from the refs frees it to re-arrange when a layoutVariant is set.
  const editImages =
    options.includeLogo && options.logoUrl ? [...refUrls, options.logoUrl] : refUrls;

  // The editor can hand us freshly-edited copy that isn't persisted on the tile
  // yet (the "save" action renders + persists in one call). Prefer it.
  const effectiveAdCopy =
    options.adCopyOverride !== undefined ? options.adCopyOverride : tile.adCopy;

  // Rebuild the prompt whenever copy / palette / logo / layout can influence it;
  // only fall back to the persisted enhanced prompt for a plain, override-free
  // variation.
  const mustRebuild =
    !!effectiveAdCopy ||
    !!options.paletteOverride ||
    !!options.includeLogo ||
    !!options.layoutVariant;
  // Wide-ad formats render as a constant-count stacked banner sheet; keep that
  // on any rebuild so an edited/relaid-out stacked tile stays a stacked sheet
  // (not a single banner at the strip ratio).
  const stackOpt = isStackedPreset(tile.presetId) ? { stackCount: AD_STACK_COUNT } : {};
  const persisted = campaign.enhancedPrompts?.[tile.presetId];
  const enhanced: EnhancedPrompt = mustRebuild
    ? buildCampaignPrompt({
        brief: campaign.brief,
        brand: effectiveBrand,
        preset,
        referenceCount: editImages.length,
        ...stackOpt,
        ...(effectiveAdCopy ? { adCopy: effectiveAdCopy } : {}),
        ...(options.includeLogo ? { logo: true } : {}),
        ...(options.layoutVariant ? { layoutVariant: options.layoutVariant } : {}),
      })
    : isEnhancedPrompt(persisted)
      ? persisted
      : buildCampaignPrompt({
          brief: campaign.brief,
          brand: effectiveBrand,
          preset,
          referenceCount: editImages.length,
          ...stackOpt,
        });

  // A user-typed prompt wins over the assembled one as the generation base.
  const basePrompt =
    options.promptOverride && options.promptOverride.trim()
      ? options.promptOverride.trim()
      : resolveFinalPrompt(enhanced);
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
    // Ad presets are center-cropped to exact pixel sizes; request more source
    // pixels so the crop stays sharp. Mirrors the cook route. Social presets
    // keep the 1K default. (estimate uses this same input → cost parity.)
    ...(isAdPreset(tile.presetId) ? { resolution: '2K' as const } : {}),
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(editImages.length > 0 ? { images: editImages } : {}),
  };

  return { input, prompt };
}
