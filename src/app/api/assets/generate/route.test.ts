import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { submitImageGenMock } = vi.hoisted(() => ({ submitImageGenMock: vi.fn() }));
const { recordGenerationMock } = vi.hoisted(() => ({ recordGenerationMock: vi.fn() }));
const { recordBuzzEventMock } = vi.hoisted(() => ({ recordBuzzEventMock: vi.fn() }));

const { FakeOrchestratorError, FakeMissingReferenceError } = vi.hoisted(() => {
  class FakeOrchestratorError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  class FakeMissingReferenceError extends Error {
    readonly count: number;
    readonly kind: 'assets' | 'products';
    constructor(count: number, kind: 'assets' | 'products') {
      super('missing');
      this.name = 'MissingReferenceError';
      this.count = count;
      this.kind = kind;
    }
  }
  return { FakeOrchestratorError, FakeMissingReferenceError };
});

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/assets', () => ({
  getPublicUrls: getPublicUrlsMock,
  MissingReferenceError: FakeMissingReferenceError,
}));
vi.mock('@/lib/civitai', () => ({
  submitImageGen: submitImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/assets/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    prompt: 'a cinematic shot of a fox in a neon city',
    aspectRatio: '1:1',
    numImages: 2,
    referenceAssetIds: [],
    ...overrides,
  };
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
  getPublicUrlsMock.mockImplementation(async (_userId: string, ids: string[]) =>
    ids.map((id) => `https://cdn.test/${id}`),
  );
  submitImageGenMock.mockResolvedValue({
    id: 'wf_adhoc_1',
    status: 'pending',
    cost: { total: 42 },
  });
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/assets/generate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
    expect(submitImageGenMock).not.toHaveBeenCalled();
  });

  it('returns 400 on empty prompt', async () => {
    const res = await POST(makeRequest(validBody({ prompt: '' })) as never);
    expect(res.status).toBe(400);
    expect(submitImageGenMock).not.toHaveBeenCalled();
  });

  it('returns 400 when numImages is out of range (0)', async () => {
    const res = await POST(makeRequest(validBody({ numImages: 0 })) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when numImages is out of range (5)', async () => {
    const res = await POST(makeRequest(validBody({ numImages: 5 })) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid aspectRatio', async () => {
    const res = await POST(makeRequest(validBody({ aspectRatio: '2:3' })) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when MissingReferenceError thrown and does not leak ids', async () => {
    getPublicUrlsMock.mockRejectedValueOnce(new FakeMissingReferenceError(2, 'assets'));
    const res = await POST(
      makeRequest(
        validBody({
          referenceAssetIds: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
          ],
        }),
      ) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_reference_assets');
    expect(json.missing).toBe(2);
    expect(json.kind).toBe('assets');
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('11111111-1111-1111-1111-111111111111');
    expect(serialized).not.toContain('22222222-2222-2222-2222-222222222222');
  });

  it('calls submitImageGen with the expected payload (no refs)', async () => {
    const res = await POST(
      makeRequest(
        validBody({
          prompt: 'hello world',
          aspectRatio: '4:5',
          numImages: 3,
          resolution: '2K',
          negativePrompt: 'blurry',
        }),
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(submitImageGenMock).toHaveBeenCalledTimes(1);
    const [sessionArg, inputArg] = submitImageGenMock.mock.calls[0]!;
    expect(sessionArg).toMatchObject({ tokens: { access_token: 'tok' } });
    expect(inputArg).toEqual({
      prompt: 'hello world',
      aspectRatio: '4:5',
      numImages: 3,
      resolution: '2K',
      negativePrompt: 'blurry',
    });
    // engine/model defaults are baked into the wrapper — route should not set them
    expect(inputArg).not.toHaveProperty('engine');
    expect(inputArg).not.toHaveProperty('model');
  });

  it('on success: returns {workflowId, estimatedBuzz}', async () => {
    submitImageGenMock.mockResolvedValueOnce({
      id: 'wf_adhoc_success',
      status: 'pending',
      cost: { total: 87 },
    });
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ workflowId: 'wf_adhoc_success', estimatedBuzz: 87 });
  });

  it('writes one generations row with source: adhoc and one estimate buzz event', async () => {
    await POST(makeRequest(validBody()) as never);
    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    const genInput = recordGenerationMock.mock.calls[0]![0];
    expect(genInput.source).toBe('adhoc');
    expect(genInput.userId).toBe('user_1');
    expect(genInput.workflowId).toBe('wf_adhoc_1');
    expect(genInput.sourceId).toBeNull();
    expect(genInput.tileId).toBeNull();
    expect(genInput.prompt).toBe('a cinematic shot of a fox in a neon city');
    expect(genInput.estimatedBuzz).toBe(42);

    expect(recordBuzzEventMock).toHaveBeenCalledTimes(1);
    const buzzInput = recordBuzzEventMock.mock.calls[0]![0];
    expect(buzzInput.kind).toBe('estimate');
    expect(buzzInput.userId).toBe('user_1');
    expect(buzzInput.workflowId).toBe('wf_adhoc_1');
    expect(buzzInput.estimated).toBe(42);
    expect(buzzInput.note).toBe('adhoc');
  });

  it('never records a submit buzz event (that lands at workflow terminal time)', async () => {
    await POST(makeRequest(validBody()) as never);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).not.toContain('submit');
  });

  it('references: getPublicUrls called with userKey first, resolved URLs land in images[]', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['ref-a', 'ref-b'] })) as never);
    expect(getPublicUrlsMock).toHaveBeenCalledTimes(1);
    expect(getPublicUrlsMock).toHaveBeenCalledWith('user_1', ['ref-a', 'ref-b']);
    const inputArg = submitImageGenMock.mock.calls[0]![1];
    expect(inputArg.images).toEqual(['https://cdn.test/ref-a', 'https://cdn.test/ref-b']);
  });

  it('omits images[] when no references provided', async () => {
    await POST(makeRequest(validBody()) as never);
    const inputArg = submitImageGenMock.mock.calls[0]![1];
    expect(inputArg.images).toBeUndefined();
    expect(getPublicUrlsMock).not.toHaveBeenCalled();
  });

  it('returns orchestrator_error with upstream status when OrchestratorError thrown', async () => {
    submitImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json).toEqual({ error: 'orchestrator_error' });
    // no DB writes on submit failure
    expect(recordGenerationMock).not.toHaveBeenCalled();
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('does not reflect OrchestratorError body to client', async () => {
    submitImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('boom', 402, { code: 'INTERNAL_TRACE_INFO' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    const json = await res.json();
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('INTERNAL_TRACE_INFO');
  });

  it('rejects more than 4 reference assets', async () => {
    const res = await POST(
      makeRequest(validBody({ referenceAssetIds: ['a', 'b', 'c', 'd', 'e'] })) as never,
    );
    expect(res.status).toBe(400);
    expect(submitImageGenMock).not.toHaveBeenCalled();
  });
});
