import { buildImageGenBody } from '@civitai/app-sdk/orchestrator';

const STARTER_TAG = 'next-app';

/** Workflow tags attached to every Vitrine orchestrator submission. */
export const TAGS: string[] = ['civitai-app-starter', STARTER_TAG];

/**
 * Buzz pools Vitrine is allowed to spend, in preference order. We restrict
 * to the `green` pool — green Buzz is SFW-only promotional Buzz, and every
 * Vitrine workflow generates brand-safe content. Maps to the orchestrator
 * workflow body's top-level `currencies` field (an ordered set of
 * `BuzzClientAccount` values; see the v2-consumers OpenAPI schema). Restricting
 * the set means a workflow that can't be paid from green fails the estimate
 * rather than silently falling back to yellow.
 */
export const VITRINE_CURRENCIES = ['green'] as const;

/**
 * Attach Vitrine's {@link VITRINE_CURRENCIES} to a workflow body produced by an
 * SDK `build*Body` helper (which only sets `steps`/`tags`). Applied to every
 * estimate + submit so the cost preview and the real debit both draw from the
 * same pool.
 */
export function withVitrineCurrencies(body: unknown): unknown {
  return { ...(body as Record<string, unknown>), currencies: VITRINE_CURRENCIES };
}

/** Default `imageGen` engine — Google. Pair with {@link DEFAULT_IMAGE_MODEL}. */
export const DEFAULT_IMAGE_ENGINE = 'google';
/** Default `imageGen` model — Nano Banana 2. Multi-modal; reference images optional. */
export const DEFAULT_IMAGE_MODEL = 'nano-banana-2';

/**
 * Vitrine-specific input shape for the single `imageGen` path used by both
 * campaigns and photoshoots. No `server-only` import, so plain Node scripts
 * (e.g. the prompt-lab CLI) can build identical bodies to the app.
 */
export type VitrineImageGenInput = {
  prompt: string;
  negativePrompt?: string;
  /** Reference images. URL, data URL, or raw base64 string. */
  images?: string[];
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '8:1' | '4:1' | '5:4';
  numImages: number;
  resolution?: '1K' | '2K';
  /** Override the default engine (`google`). */
  engine?: string;
  /** Override the default model (`nano-banana-2`). */
  model?: string;
};

export function buildVitrineImageGenBody(input: VitrineImageGenInput): unknown {
  return withVitrineCurrencies(
    buildImageGenBody(
      {
        engine: input.engine ?? DEFAULT_IMAGE_ENGINE,
        model: input.model ?? DEFAULT_IMAGE_MODEL,
        prompt: input.prompt,
        ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
        ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
        aspectRatio: input.aspectRatio,
        numImages: input.numImages,
        resolution: input.resolution ?? '1K',
      },
      { tags: TAGS },
    ),
  );
}
