import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { estimateVideoAnimateMock } = vi.hoisted(() => ({
  estimateVideoAnimateMock: vi.fn(),
}));
const { submitVideoAnimateMock } = vi.hoisted(() => ({
  submitVideoAnimateMock: vi.fn(),
}));
const { extractImageUrlsMock } = vi.hoisted(() => ({ extractImageUrlsMock: vi.fn() }));
const { recordGenerationMock } = vi.hoisted(() => ({ recordGenerationMock: vi.fn() }));
const { recordBuzzEventMock } = vi.hoisted(() => ({ recordBuzzEventMock: vi.fn() }));
const { refreshGenerationSnapshotMock } = vi.hoisted(() => ({
  refreshGenerationSnapshotMock: vi.fn(),
}));

const parentRowQueue: Array<Record<string, unknown> | undefined> = [];

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

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/civitai', () => ({
  estimateVideoAnimate: estimateVideoAnimateMock,
  submitVideoAnimate: submitVideoAnimateMock,
  extractImageUrls: extractImageUrlsMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/generations', () => ({
  recordGeneration: recordGenerationMock,
  refreshGenerationSnapshot: refreshGenerationSnapshotMock,
}));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const next = parentRowQueue.shift();
            return Promise.resolve(next ? [next] : []);
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/lib/db/schema', () => ({
  generations: { workflowId: 'generations.workflow_id' },
}));
vi.mock('drizzle-orm', () => ({ eq: () => undefined, and: () => undefined }));

import { POST } from './route';

function makeRequest(body?: unknown): Request {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request(
    'http://localhost/api/generations/wf_parent/images/0/animate',
    init,
  );
}

function makeParams(workflowId = 'wf_parent', index = '0') {
  return { params: Promise.resolve({ workflowId, index }) };
}

function makeParentRow(over: Record<string, unknown> = {}) {
  return {
    workflowId: 'wf_parent',
    userId: 'user_1',
    source: 'campaign',
    sourceId: 'campaign_1',
    tileId: 'tile_1',
    parentWorkflowId: null,
    parentImageIndex: null,
    mediaType: 'image',
    status: 'done',
    prompt: 'original prompt',
    input: {},
    snapshot: { id: 'wf_parent', status: 'succeeded' },
    estimatedBuzz: 0,
    chargedBuzz: 0,
    error: null,
    submittedAt: new Date(0),
    finishedAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  parentRowQueue.length = 0;
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
  extractImageUrlsMock.mockReturnValue(['https://cdn.test/img-0.png', 'https://cdn.test/img-1.png']);
  estimateVideoAnimateMock.mockResolvedValue({
    id: 'wf_est',
    status: 'pending',
    cost: { total: 80 },
  });
  submitVideoAnimateMock.mockResolvedValue({
    id: 'wf_video',
    status: 'pending',
    cost: { total: 80 },
  });
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
  refreshGenerationSnapshotMock.mockResolvedValue(null);
});

describe('POST /api/generations/[workflowId]/images/[index]/animate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 400 when index is not a non-negative integer', async () => {
    const res = await POST(makeRequest() as never, makeParams('wf_parent', 'abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when parent workflow does not exist', async () => {
    parentRowQueue.push(undefined);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('workflow_not_found');
  });

  it('returns 403 when workflow belongs to a different user', async () => {
    parentRowQueue.push(makeParentRow({ userId: 'someone_else' }));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden');
  });

  it('returns 404 when image index is out of range', async () => {
    parentRowQueue.push(makeParentRow());
    extractImageUrlsMock.mockReturnValue(['https://cdn.test/img-0.png']);
    const res = await POST(makeRequest() as never, makeParams('wf_parent', '7'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('image_index_out_of_range');
  });

  it('on success: creates animate generation with mediaType=video and parent linkage', async () => {
    parentRowQueue.push(makeParentRow());
    const res = await POST(makeRequest() as never, makeParams('wf_parent', '1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowId).toBe('wf_video');
    expect(body.parentWorkflowId).toBe('wf_parent');
    expect(body.parentImageIndex).toBe(1);
    expect(body.estimatedBuzz).toBe(80);

    expect(submitVideoAnimateMock).toHaveBeenCalled();
    expect(submitVideoAnimateMock.mock.calls[0]![1]).toBe('https://cdn.test/img-1.png');
    expect(estimateVideoAnimateMock.mock.calls[0]![1]).toBe('https://cdn.test/img-1.png');

    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    const rec = recordGenerationMock.mock.calls[0]![0];
    expect(rec.source).toBe('animate');
    expect(rec.mediaType).toBe('video');
    expect(rec.parentWorkflowId).toBe('wf_parent');
    expect(rec.parentImageIndex).toBe(1);
    expect(rec.estimatedBuzz).toBe(80);

    expect(recordBuzzEventMock).toHaveBeenCalledTimes(2);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain('estimate');
    expect(kinds).toContain('submit');
    for (const c of recordBuzzEventMock.mock.calls) expect(c[0].note).toBe('animate');
  });

  it('forwards optional motion prompt to estimate and submit', async () => {
    parentRowQueue.push(makeParentRow());
    const res = await POST(
      makeRequest({ prompt: 'slow zoom out' }) as never,
      makeParams('wf_parent', '0'),
    );
    expect(res.status).toBe(200);
    expect(submitVideoAnimateMock.mock.calls[0]![2]).toBe('slow zoom out');
    expect(estimateVideoAnimateMock.mock.calls[0]![2]).toBe('slow zoom out');
    const rec = recordGenerationMock.mock.calls[0]![0];
    expect(rec.input).toMatchObject({ sourceUrl: 'https://cdn.test/img-0.png', prompt: 'slow zoom out' });
  });

  it('propagates orchestrator error with original status code', async () => {
    parentRowQueue.push(makeParentRow());
    submitVideoAnimateMock.mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, {}));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(402);
  });
});
