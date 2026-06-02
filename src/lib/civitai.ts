import "server-only";
import { cache } from "react";
import { fetchBuzzAccount, fetchMe, type BuzzAccount } from "@civitai/app-sdk";
import {
  buildImageGenBody,
  buildWorkflowBody,
  createOrchestratorClient,
  estimateWorkflow,
  getWorkflow,
  submitWorkflow,
  type OrchestratorClient,
  type WorkflowSnapshot,
} from "@civitai/app-sdk/orchestrator";
import { env } from "./env";
import type { Session } from "./session";

const STARTER_TAG = "next-app";
const TAGS: string[] = ["civitai-app-starter", STARTER_TAG];

/**
 * Default `imageGen` engine — Google. Pair with {@link DEFAULT_IMAGE_MODEL}.
 * Override per call via {@link VitrineImageGenInput.engine}.
 */
export const DEFAULT_IMAGE_ENGINE = "google";
/**
 * Default `imageGen` model — Nano Banana 2. Multi-modal, accepts optional
 * reference images. Override per call via {@link VitrineImageGenInput.model}.
 */
export const DEFAULT_IMAGE_MODEL = "nano-banana-2";

/**
 * Vitrine-specific input shape for the single `imageGen` path used by both
 * campaigns and photoshoots. Reference images are optional — Nano Banana 2
 * works with or without them under the same call shape.
 */
export type VitrineImageGenInput = {
  prompt: string;
  negativePrompt?: string;
  /** Reference images. URL, data URL, or raw base64 string. */
  images?: string[];
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  numImages: number;
  resolution?: "1K" | "2K";
  /** Override the default engine (`google`). */
  engine?: string;
  /** Override the default model (`nano-banana-2`). */
  model?: string;
};

function buildVitrineImageGenBody(input: VitrineImageGenInput): unknown {
  return buildImageGenBody(
    {
      engine: input.engine ?? DEFAULT_IMAGE_ENGINE,
      model: input.model ?? DEFAULT_IMAGE_MODEL,
      prompt: input.prompt,
      ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
      ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
      aspectRatio: input.aspectRatio,
      numImages: input.numImages,
      resolution: input.resolution ?? "1K",
    },
    { tags: TAGS },
  );
}

function getClient(session: Session): OrchestratorClient {
  return createOrchestratorClient({
    accessToken: session.tokens.access_token,
    baseUrl: env.ORCHESTRATOR_URL,
  });
}

export interface MeResponse {
  id?: number;
  username?: string;
  // The endpoint returns many more fields; widen as you use them.
  [key: string]: unknown;
}

/**
 * Per-request memoised /me lookup. Keyed by access token so layout + page +
 * getUserKey can all call this without double-hitting Civitai. Cache is
 * request-scoped via React's `cache()` — no cross-user leakage.
 */
const fetchMeCached = cache(
  async (accessToken: string): Promise<MeResponse> => {
    const data = await fetchMe({ baseUrl: env.CIVITAI_BASE_URL, accessToken });
    return data as MeResponse;
  },
);

export function getMe(session: Session): Promise<MeResponse> {
  return fetchMeCached(session.tokens.access_token);
}

/**
 * Fetch the user's yellow-Buzz balance via the SDK's `fetchBuzzAccount`
 * (wraps Civitai's `buzz.getUserAccount` tRPC). Requires the `BuzzRead`
 * OAuth scope. `/api/v1/me` does NOT include balance.
 */
const fetchBuzzAccountCached = cache(
  async (accessToken: string): Promise<BuzzAccount | null> => {
    try {
      const accounts = await fetchBuzzAccount({
        baseUrl: env.CIVITAI_BASE_URL,
        accessToken,
      });
      return accounts[0] ?? null;
    } catch (err) {
      console.warn("[civitai] fetchBuzzAccount failed:", err);
      return null;
    }
  },
);

export function getBuzzAccount(session: Session): Promise<BuzzAccount | null> {
  return fetchBuzzAccountCached(session.tokens.access_token);
}

export function getWorkflowSnapshot(
  session: Session,
  workflowId: string,
): Promise<WorkflowSnapshot> {
  return getWorkflow(getClient(session), workflowId);
}

/**
 * Preview Buzz cost for an `imageGen` workflow (engine `google`, model
 * `nano-banana-2` by default) without spending Buzz.
 */
export function estimateImageGen(
  session: Session,
  input: VitrineImageGenInput,
): Promise<WorkflowSnapshot> {
  return estimateWorkflow(getClient(session), buildVitrineImageGenBody(input));
}

/**
 * Submit an `imageGen` workflow. Debits the user's Buzz. Single code path for
 * both campaign and photoshoot generation; reference images are optional.
 */
export function submitImageGen(
  session: Session,
  input: VitrineImageGenInput,
): Promise<WorkflowSnapshot> {
  return submitWorkflow(getClient(session), buildVitrineImageGenBody(input));
}

function buildUpscaleBody(sourceImageUrl: string): unknown {
  return buildWorkflowBody(
    {
      $type: "imageUpscaler",
      input: { image: sourceImageUrl, scale: 2 },
    },
    { tags: TAGS },
  );
}

/** Preview Buzz cost for a 2x upscale of an existing image URL. */
export function estimateUpscale(
  session: Session,
  sourceImageUrl: string,
): Promise<WorkflowSnapshot> {
  return estimateWorkflow(getClient(session), buildUpscaleBody(sourceImageUrl));
}

/**
 * Submit a 2x upscale workflow for an existing image URL. Post-generation
 * action — runs against a completed image, debits Buzz separately.
 */
export function submitUpscale(
  session: Session,
  sourceImageUrl: string,
): Promise<WorkflowSnapshot> {
  return submitWorkflow(getClient(session), buildUpscaleBody(sourceImageUrl));
}

// TODO: confirm videoGen engine/model with smoke test
function buildVideoAnimateBody(sourceImageUrl: string, prompt?: string): unknown {
  return buildWorkflowBody(
    {
      $type: "videoGen",
      input: {
        engine: "wan",
        model: "image-to-video",
        sourceImage: sourceImageUrl,
        ...(prompt ? { prompt } : {}),
      },
    },
    { tags: TAGS },
  );
}

/** Preview Buzz cost for an image-to-video animation. */
export function estimateVideoAnimate(
  session: Session,
  sourceImageUrl: string,
  prompt?: string,
): Promise<WorkflowSnapshot> {
  return estimateWorkflow(
    getClient(session),
    buildVideoAnimateBody(sourceImageUrl, prompt),
  );
}

/**
 * Submit an image-to-video animation workflow for an existing image URL.
 * Post-generation action — runs against a completed image, debits Buzz
 * separately.
 */
export function submitVideoAnimate(
  session: Session,
  sourceImageUrl: string,
  prompt?: string,
): Promise<WorkflowSnapshot> {
  return submitWorkflow(
    getClient(session),
    buildVideoAnimateBody(sourceImageUrl, prompt),
  );
}

export {
  DEFAULT_MODEL_AIR,
  extractImageUrls,
  isTerminal,
  OrchestratorError,
  type GenerateInput,
  type WorkflowSnapshot,
} from "@civitai/app-sdk/orchestrator";
