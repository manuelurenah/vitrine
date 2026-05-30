import "server-only";
import { cache } from "react";
import { fetchBuzzAccount, fetchMe, type BuzzAccount } from "@civitai/app-sdk";
import {
  buildTextToImageBody,
  createOrchestratorClient,
  estimateWorkflow,
  getWorkflow,
  submitWorkflow,
  type GenerateInput,
  type OrchestratorClient,
  type WorkflowSnapshot,
} from "@civitai/app-sdk/orchestrator";
import { env } from "./env";
import type { Session } from "./session";

const STARTER_TAG = "next-app";

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

/** Preview Buzz cost without spending any (whatif=true). */
export function estimateGenerationCost(
  session: Session,
  input: GenerateInput,
): Promise<WorkflowSnapshot> {
  return estimateWorkflow(
    getClient(session),
    buildTextToImageBody(input, {
      tags: ["civitai-app-starter", STARTER_TAG],
    }),
  );
}

/** Submit the workflow for real. Debits the user's Buzz. */
export function submitGeneration(
  session: Session,
  input: GenerateInput,
): Promise<WorkflowSnapshot> {
  return submitWorkflow(
    getClient(session),
    buildTextToImageBody(input, {
      tags: ["civitai-app-starter", STARTER_TAG],
    }),
  );
}

export function getWorkflowSnapshot(
  session: Session,
  workflowId: string,
): Promise<WorkflowSnapshot> {
  return getWorkflow(getClient(session), workflowId);
}

export {
  DEFAULT_MODEL_AIR,
  extractImageUrls,
  isTerminal,
  OrchestratorError,
  type GenerateInput,
  type WorkflowSnapshot,
} from "@civitai/app-sdk/orchestrator";
