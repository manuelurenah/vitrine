import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { estimateUpscaleMock } = vi.hoisted(() => ({ estimateUpscaleMock: vi.fn() }));
const { submitUpscaleMock } = vi.hoisted(() => ({ submitUpscaleMock: vi.fn() }));
const { extractImageUrlsMock } = vi.hoisted(() => ({ extractImageUrlsMock: vi.fn() }));
const { recordGenerationMock } = vi.hoisted(() => ({ recordGenerationMock: vi.fn() }));
const { recordBuzzEventMock } = vi.hoisted(() => ({ recordBuzzEventMock: vi.fn() }));
const { refreshGenerationSnapshotMock } = vi.hoisted(() => ({
  refreshGenerationSnapshotMock: vi.fn(),
}));

// Parent row queue: each db.select().from().where().limit() consumes the next entry.
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
  estimateUpscale: estimateUpscaleMock,
  submitUpscale: submitUpscaleMock,
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

function makeRequest(): Request {
  return new Request('http://localhost/api/generations/wf_parent/images/0/upscale', {
    method: 'POST',
  });
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
  extractImageUrlsMock.mockReturnValue([
    'https://cdn.test/img-0.png',
    'https://cdn.test/img-1.png',
  ]);
  estimateUpscaleMock.mockResolvedValue({ id: 'wf_est', status: 'pending', cost: { total: 12 } });
  submitUpscaleMock.mockResolvedValue({ id: 'wf_new', status: 'pending', cost: { total: 12 } });
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
  refreshGenerationSnapshotMock.mockResolvedValue(null);
});

describe('POST /api/generations/[workflowId]/images/[index]/upscale', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 400 when index is not a non-negative integer', async () => {
    const res = await POST(makeRequest() as never, makeParams('wf_parent', '-3'));
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
    const res = await POST(makeRequest() as never, makeParams('wf_parent', '5'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('image_index_out_of_range');
  });

  it('on success: creates upscale generation row with parent linkage and records buzz', async () => {
    parentRowQueue.push(makeParentRow());
    const res = await POST(makeRequest() as never, makeParams('wf_parent', '1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowId).toBe('wf_new');
    expect(body.parentWorkflowId).toBe('wf_parent');
    expect(body.parentImageIndex).toBe(1);
    expect(body.estimatedBuzz).toBe(12);

    expect(submitUpscaleMock).toHaveBeenCalledWith(expect.anything(), 'https://cdn.test/img-1.png');
    expect(estimateUpscaleMock).toHaveBeenCalledWith(
      expect.anything(),
      'https://cdn.test/img-1.png',
    );

    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    const rec = recordGenerationMock.mock.calls[0]![0];
    expect(rec.source).toBe('upscale');
    expect(rec.parentWorkflowId).toBe('wf_parent');
    expect(rec.parentImageIndex).toBe(1);
    expect(rec.mediaType).toBe('image');
    expect(rec.sourceId).toBe('campaign_1');
    expect(rec.tileId).toBe('tile_1');
    expect(rec.estimatedBuzz).toBe(12);

    // Estimate + submit buzz events with note='upscale'
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(2);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain('estimate');
    expect(kinds).toContain('submit');
    for (const c of recordBuzzEventMock.mock.calls) expect(c[0].note).toBe('upscale');
  });

  it('propagates orchestrator error with original status code', async () => {
    parentRowQueue.push(makeParentRow());
    submitUpscaleMock.mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, {}));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(402);
  });
});
