import 'server-only';
import { fetchMe, revokeToken } from '@civitai/app-sdk';
import {
  buildWorkflowBody,
  createOrchestratorClient,
  estimateWorkflow,
  getWorkflow,
  type OrchestratorClient,
  OrchestratorError,
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

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/**
 * A non-retryable client error: any 4xx EXCEPT 429 (rate limit). These won't
 * succeed on retry — bad request, auth, not-found, insufficient-buzz, etc.
 * 429 and 5xx (and network/unknown errors) ARE retryable.
 */
function isNonRetryableOrchestratorError(err: unknown): boolean {
  if (!(err instanceof OrchestratorError)) return false;
  const { status } = err;
  return (status >= 400 && status <= 428) || (status >= 431 && status <= 499);
}

/**
 * `submitImageGen` with retry + exponential backoff. Firing many submits at
 * once (campaign cook fans out preset × variant) means a fraction transiently
 * fail with orchestrator rate-limit / 5xx; without a retry they get silently
 * dropped and the user receives fewer variants than requested.
 *
 * Retries on 429, 5xx, and network/unknown errors. Does NOT retry on a
 * non-retryable 4xx (everything except 429) — those won't succeed on retry, so
 * we rethrow immediately. Rethrows the last error once all attempts are spent.
 */
export async function submitImageGenWithRetry(
  session: Session,
  input: VitrineImageGenInput,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<WorkflowSnapshot> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await submitImageGen(session, input);
    } catch (err) {
      lastError = err;
      if (isNonRetryableOrchestratorError(err)) throw err;
      if (attempt >= attempts) break;
      // Exponential backoff with jitter. App-code, so Math.random is fine.
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = backoff > 0 ? Math.random() * baseDelayMs : 0;
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}

export { mapWithConcurrency } from './concurrency';

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

/**
 * Best-effort revoke of the session's OAuth grant at Civitai. Revokes the
 * access token then the refresh token; each is wrapped because either may
 * already be invalid. Never throws — callers always proceed to clear the
 * local session regardless.
 */
export async function revokeSessionGrant(session: Session): Promise<void> {
  const tryRevoke = async (token: string) => {
    try {
      await revokeToken({
        baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL,
        clientId: env.CIVITAI_CLIENT_ID,
        clientSecret: env.CIVITAI_CLIENT_SECRET,
        token,
      });
    } catch {
      // Best-effort — token may already be invalid.
    }
  };
  if (session.tokens.access_token) await tryRevoke(session.tokens.access_token);
  if (session.tokens.refresh_token) await tryRevoke(session.tokens.refresh_token);
}
