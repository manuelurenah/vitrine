import { beforeEach, describe, expect, it, vi } from 'vitest';

// `submitImageGenWithRetry` calls `submitImageGen`, which is a thin wrapper over
// the SDK's `submitWorkflow`. We mock the orchestrator module so we can drive
// success/failure per attempt, while keeping the REAL `OrchestratorError` class
// so the helper's `instanceof` + status checks behave exactly as in prod.
const { submitWorkflowMock } = vi.hoisted(() => ({ submitWorkflowMock: vi.fn() }));

vi.mock('@civitai/app-sdk/orchestrator', async () => {
  const actual =
    await vi.importActual<typeof import('@civitai/app-sdk/orchestrator')>(
      '@civitai/app-sdk/orchestrator',
    );
  return { ...actual, submitWorkflow: submitWorkflowMock };
});

// Stub the SDK barrel — only `fetchMe`/`revokeToken` are pulled from it and the
// retry path never touches them.
vi.mock('@civitai/app-sdk', () => ({ fetchMe: vi.fn(), revokeToken: vi.fn() }));

// Env validation isn't relevant to the retry unit; stub it so import doesn't
// require a fully-populated process.env.
vi.mock('./env', () => ({
  env: {
    ORCHESTRATOR_URL: 'https://orch.test',
    NEXT_PUBLIC_CIVITAI_BASE_URL: 'https://civitai.test',
    CIVITAI_CLIENT_ID: 'id',
    CIVITAI_CLIENT_SECRET: 'secret',
  },
}));

import { OrchestratorError } from '@civitai/app-sdk/orchestrator';
import { submitImageGenWithRetry } from './civitai';
import type { Session } from './session';

const session = {
  tokens: {
    access_token: 'tok',
    refresh_token: 'r',
    expires_at: Date.now() + 60_000,
    token_type: 'Bearer',
    scope: 0,
  },
} as unknown as Session;

const input = { prompt: 'hi', aspectRatio: '1:1' as const, numImages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitImageGenWithRetry', () => {
  it('retries transient failures: fails twice then succeeds → resolves after 3 tries', async () => {
    submitWorkflowMock
      .mockRejectedValueOnce(new OrchestratorError('rate limited', 429, null))
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ id: 'wf_ok', status: 'pending', cost: { total: 7 } });

    const snap = await submitImageGenWithRetry(session, input, { baseDelayMs: 0 });

    expect(snap.id).toBe('wf_ok');
    expect(submitWorkflowMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry a non-retryable 4xx (400) → rejects immediately (1 call)', async () => {
    const err = new OrchestratorError('bad request', 400, { code: 'BAD' });
    submitWorkflowMock.mockRejectedValue(err);

    await expect(
      submitImageGenWithRetry(session, input, { baseDelayMs: 0 }),
    ).rejects.toBe(err);
    expect(submitWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry other non-429 4xx (402, 404)', async () => {
    for (const status of [402, 404, 428, 431, 499]) {
      submitWorkflowMock.mockClear();
      submitWorkflowMock.mockRejectedValue(new OrchestratorError('client err', status, null));
      await expect(
        submitImageGenWithRetry(session, input, { baseDelayMs: 0 }),
      ).rejects.toBeInstanceOf(OrchestratorError);
      expect(submitWorkflowMock).toHaveBeenCalledTimes(1);
    }
  });

  it('retries a 429 across all attempts then rejects after `attempts` calls', async () => {
    const err = new OrchestratorError('too many requests', 429, null);
    submitWorkflowMock.mockRejectedValue(err);

    await expect(
      submitImageGenWithRetry(session, input, { attempts: 3, baseDelayMs: 0 }),
    ).rejects.toBe(err);
    expect(submitWorkflowMock).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx then rejects after the default 3 attempts', async () => {
    submitWorkflowMock.mockRejectedValue(new OrchestratorError('upstream down', 503, null));

    await expect(
      submitImageGenWithRetry(session, input, { baseDelayMs: 0 }),
    ).rejects.toBeInstanceOf(OrchestratorError);
    expect(submitWorkflowMock).toHaveBeenCalledTimes(3);
  });
});
