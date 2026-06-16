import 'server-only';
import { fetchMe } from '@civitai/app-sdk';
import {
  buildWorkflowBody,
  createOrchestratorClient,
  estimateWorkflow,
  getWorkflow,
  type OrchestratorClient,
  submitWorkflow,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
import { cache } from 'react';
import { env } from './env';
import type { Session } from './session';

import { buildVitrineImageGenBody, TAGS, type VitrineImageGenInput } from './imageGenBody';

export {
  buildVitrineImageGenBody,
  DEFAULT_IMAGE_ENGINE,
  DEFAULT_IMAGE_MODEL,
  type VitrineImageGenInput,
} from './imageGenBody';

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
const fetchMeCached = cache(async (accessToken: string): Promise<MeResponse> => {
  const data = await fetchMe({ baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL, accessToken });
  return data as MeResponse;
});

export function getMe(session: Session): Promise<MeResponse> {
  return fetchMeCached(session.tokens.access_token);
}

/**
 * Aggregate Buzz balance across pools. `yellow` is the spendable balance
 * everyone sees; `blue`/`green` are reserved/promotional. We expose
 * `balance` as `yellow` for the shell pill and surface raw pools for any
 * future per-pool UI.
 */
export type BuzzBalance = {
  /** Spendable balance (yellow pool). */
  balance: number;
  blue: number;
  green: number;
  yellow: number;
};

/**
 * Fetch the user's Buzz balance via Civitai's `buzz.getBuzzAccount` tRPC.
 * Requires the `BuzzRead` OAuth scope; `/api/v1/me` does NOT include
 * balance.
 *
 * Bypasses the SDK's `fetchBuzzAccount` helper (targets the wrong procedure
 * `buzz.getUserAccount` and returns the wrong shape). Opts out of caching:
 * `cache: 'no-store'` keeps Next's data cache off, and a `t=${Date.now()}`
 * query bypasses any upstream/edge cache that ignores Authorization.
 * Balance must reflect the latest Buzz spend immediately after a
 * cook/regenerate.
 */
const fetchBuzzAccountCached = cache(async (accessToken: string): Promise<BuzzBalance | null> => {
  try {
    const url = `${env.NEXT_PUBLIC_CIVITAI_BASE_URL}/api/trpc/buzz.getBuzzAccount?t=${Date.now()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(
        '[civitai] buzz.getBuzzAccount failed:',
        res.status,
        await res.text().catch(() => ''),
      );
      return null;
    }
    // tRPC envelope variants:
    //   { result: { data: { json: { yellow, blue, green } } } }   (superjson)
    //   { result: { data: { yellow, blue, green } } }             (no transformer)
    //   { yellow, blue, green }                                   (raw — defensive)
    type Pools = { yellow?: number; blue?: number; green?: number };
    const body = (await res.json()) as Pools | { result?: { data?: Pools | { json?: Pools } } };
    const inner =
      'result' in body
        ? (() => {
            const d = body.result?.data;
            if (!d) return null;
            return 'json' in d ? (d.json ?? null) : (d as Pools);
          })()
        : (body as Pools);
    if (!inner) return null;
    return {
      balance: inner.yellow ?? 0,
      yellow: inner.yellow ?? 0,
      blue: inner.blue ?? 0,
      green: inner.green ?? 0,
    };
  } catch (err) {
    console.warn('[civitai] fetchBuzzAccount failed:', err);
    return null;
  }
});

export function getBuzzAccount(session: Session): Promise<BuzzBalance | null> {
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
      $type: 'imageUpscaler',
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
export function submitUpscale(session: Session, sourceImageUrl: string): Promise<WorkflowSnapshot> {
  return submitWorkflow(getClient(session), buildUpscaleBody(sourceImageUrl));
}

// TODO: confirm videoGen engine/model with smoke test
function buildVideoAnimateBody(sourceImageUrl: string, prompt?: string): unknown {
  return buildWorkflowBody(
    {
      $type: 'videoGen',
      input: {
        engine: 'wan',
        model: 'image-to-video',
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
  return estimateWorkflow(getClient(session), buildVideoAnimateBody(sourceImageUrl, prompt));
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
  return submitWorkflow(getClient(session), buildVideoAnimateBody(sourceImageUrl, prompt));
}

export {
  DEFAULT_MODEL_AIR,
  extractImageUrls,
  isTerminal,
  OrchestratorError,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
