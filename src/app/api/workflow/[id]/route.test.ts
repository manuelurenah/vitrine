import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { updateGenerationFromSnapshotMock } = vi.hoisted(() => ({
  updateGenerationFromSnapshotMock: vi.fn(),
}));
const { refreshGenerationSnapshotMock } = vi.hoisted(() => ({
  refreshGenerationSnapshotMock: vi.fn(),
}));
const { getGenerationMock } = vi.hoisted(() => ({ getGenerationMock: vi.fn() }));
const { markTileFailedMock } = vi.hoisted(() => ({ markTileFailedMock: vi.fn() }));
const { syncAssetsFromSnapshotMock } = vi.hoisted(() => ({
  // Regression guard — this should NEVER be called from the workflow route.
  // We export the mock so tests can assert on its (lack of) invocation.
  syncAssetsFromSnapshotMock: vi.fn(),
}));
const { recordBuzzEventMock } = vi.hoisted(() => ({ recordBuzzEventMock: vi.fn() }));
const { pollWorkflowMock } = vi.hoisted(() => ({ pollWorkflowMock: vi.fn() }));
const { isTerminalMock } = vi.hoisted(() => ({ isTerminalMock: vi.fn() }));
const { createOrchestratorClientMock } = vi.hoisted(() => ({
  createOrchestratorClientMock: vi.fn(),
}));

const { FakeOrchestratorError } = vi.hoisted(() => {
  class FakeOrchestratorError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { FakeOrchestratorError };
});

vi.mock('@civitai/app-sdk/orchestrator', () => ({
  createOrchestratorClient: createOrchestratorClientMock,
  pollWorkflow: pollWorkflowMock,
  isTerminal: isTerminalMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/generations', () => ({
  updateGenerationFromSnapshot: updateGenerationFromSnapshotMock,
  refreshGenerationSnapshot: refreshGenerationSnapshotMock,
  getGeneration: getGenerationMock,
}));
vi.mock('@/lib/assets', () => ({
  markTileFailed: markTileFailedMock,
  syncAssetsFromSnapshot: syncAssetsFromSnapshotMock,
}));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));
vi.mock('@/lib/env', () => ({
  env: { ORCHESTRATOR_URL: 'https://orch.test' },
}));

import { GET } from './route';

function makeRequest(wait = 0): Request {
  return new Request(`http://localhost/api/workflow/wf_1?wait=${wait}`, {
    method: 'GET',
  });
}

function makeCtx(id = 'wf_1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({
    tokens: {
      access_token: 'tok',
      refresh_token: 'r',
      expires_at: Date.now() + 60_000,
      token_type: 'Bearer',
      scope: 0,
    },
  });
  getUserKeyMock.mockResolvedValue('user_1');
  createOrchestratorClientMock.mockReturnValue({ accessToken: 'tok' });
  // Default: workflow is owned by the requesting user.
  getGenerationMock.mockResolvedValue({ workflowId: 'wf_1', userId: 'user_1', chargedBuzz: 0 });
  updateGenerationFromSnapshotMock.mockResolvedValue({ chargedBuzz: 0 });
  refreshGenerationSnapshotMock.mockResolvedValue(null);
  markTileFailedMock.mockResolvedValue(undefined);
  syncAssetsFromSnapshotMock.mockResolvedValue(0);
  recordBuzzEventMock.mockResolvedValue({});
});

describe('GET /api/workflow/[id]', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(401);
  });

  it('returns snapshot + done when workflow non-terminal', async () => {
    pollWorkflowMock.mockResolvedValueOnce({ id: 'wf_1', status: 'processing' });
    isTerminalMock.mockReturnValueOnce(false);
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.done).toBe(false);
    expect(updateGenerationFromSnapshotMock).not.toHaveBeenCalled();
  });

  it('on terminal success: updates generation, does NOT call syncAssetsFromSnapshot (regression guard)', async () => {
    pollWorkflowMock.mockResolvedValueOnce({
      id: 'wf_1',
      status: 'succeeded',
      cost: { total: 7 },
    });
    isTerminalMock.mockReturnValueOnce(true);
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(200);
    expect(updateGenerationFromSnapshotMock).toHaveBeenCalledTimes(1);
    // The critical regression guard:
    expect(syncAssetsFromSnapshotMock).not.toHaveBeenCalled();
    expect(markTileFailedMock).not.toHaveBeenCalled();
  });

  it('on terminal success: records a submit buzz event when charged > 0', async () => {
    pollWorkflowMock.mockResolvedValueOnce({
      id: 'wf_1',
      status: 'succeeded',
      cost: { total: 7 },
    });
    isTerminalMock.mockReturnValueOnce(true);
    updateGenerationFromSnapshotMock.mockResolvedValueOnce({ chargedBuzz: 0 });
    await GET(makeRequest() as never, makeCtx());
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(1);
    expect(recordBuzzEventMock.mock.calls[0]![0]).toMatchObject({
      kind: 'submit',
      charged: 7,
      note: 'workflow_done',
    });
  });

  it('on terminal success: skips buzz event when already recorded (chargedBuzz unchanged)', async () => {
    // Pre-existing row already shows chargedBuzz=7. Polling sees same value.
    // The fixed guard compares pre-update chargedBuzz against snapshot.cost.
    getGenerationMock.mockResolvedValueOnce({
      workflowId: 'wf_1',
      userId: 'user_1',
      chargedBuzz: 7,
    });
    pollWorkflowMock.mockResolvedValueOnce({
      id: 'wf_1',
      status: 'succeeded',
      cost: { total: 7 },
    });
    isTerminalMock.mockReturnValueOnce(true);
    updateGenerationFromSnapshotMock.mockResolvedValueOnce({ chargedBuzz: 7 });
    await GET(makeRequest() as never, makeCtx());
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the workflow does not belong to the user', async () => {
    getGenerationMock.mockResolvedValueOnce({
      workflowId: 'wf_1',
      userId: 'someone_else',
      chargedBuzz: 0,
    });
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(404);
    expect(pollWorkflowMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the workflow row does not exist', async () => {
    getGenerationMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(404);
  });

  it('on terminal failure: calls markTileFailed, does NOT record submit buzz, does NOT sync assets', async () => {
    pollWorkflowMock.mockResolvedValueOnce({
      id: 'wf_1',
      status: 'failed',
      cost: { total: 0 },
    });
    isTerminalMock.mockReturnValueOnce(true);
    await GET(makeRequest() as never, makeCtx());
    expect(markTileFailedMock).toHaveBeenCalledTimes(1);
    expect(syncAssetsFromSnapshotMock).not.toHaveBeenCalled();
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('surfaces OrchestratorError as the corresponding status', async () => {
    pollWorkflowMock.mockRejectedValueOnce(
      new FakeOrchestratorError('boom', 404, { code: 'NOT_FOUND' }),
    );
    const res = await GET(makeRequest() as never, makeCtx());
    expect(res.status).toBe(404);
  });
});
