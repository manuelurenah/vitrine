import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { estimateImageGenMock } = vi.hoisted(() => ({ estimateImageGenMock: vi.fn() }));
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
  estimateImageGen: estimateImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/assets/generate/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    prompt: 'a cyberpunk fox',
    aspectRatio: '1:1',
    numImages: 2,
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
  estimateImageGenMock.mockResolvedValue({
    id: 'wf_estimate',
    status: 'unassigned',
    cost: { total: 42 },
  });
});

describe('POST /api/assets/generate/estimate', () => {
  it('returns 401 without session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    const res = await POST(makeRequest({ prompt: '' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns the whatif cost without writing anything to the DB', async () => {
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estimatedBuzz: 42 });
    expect(recordGenerationMock).not.toHaveBeenCalled();
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('calls estimateImageGen (whatif) — never submitImageGen', async () => {
    await POST(makeRequest(validBody()) as never);
    expect(estimateImageGenMock).toHaveBeenCalledTimes(1);
    const callInput = estimateImageGenMock.mock.calls[0]![1];
    expect(callInput.prompt).toBe('a cyberpunk fox');
    expect(callInput.aspectRatio).toBe('1:1');
    expect(callInput.numImages).toBe(2);
    expect(callInput.images).toBeUndefined();
  });

  it('threads reference URLs into images[] (scoped to user)', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['a1', 'a2'] })) as never);
    expect(getPublicUrlsMock).toHaveBeenCalledWith('user_1', ['a1', 'a2']);
    expect(estimateImageGenMock.mock.calls[0]![1].images).toEqual([
      'https://cdn.test/a1',
      'https://cdn.test/a2',
    ]);
  });

  it('returns 400 with sanitized body when references are missing (no UUID leak)', async () => {
    getPublicUrlsMock.mockRejectedValueOnce(new FakeMissingReferenceError(1, 'assets'));
    const res = await POST(makeRequest(validBody({ referenceAssetIds: ['ghost'] })) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_reference_assets');
    expect(json.missing).toBe(1);
    expect(json.kind).toBe('assets');
    expect(JSON.stringify(json)).not.toContain('ghost');
  });

  it('forwards orchestrator status on upstream failure (no body leak)', async () => {
    estimateImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'TRACE_DO_NOT_LEAK' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('orchestrator_error');
    expect(JSON.stringify(json)).not.toContain('TRACE_DO_NOT_LEAK');
  });

  it('coerces non-4xx/5xx orchestrator status to 502', async () => {
    estimateImageGenMock.mockRejectedValueOnce(new FakeOrchestratorError('weird', 0, null));
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'orchestrator_error' });
  });

  it('threads negativePrompt and resolution into estimate input', async () => {
    await POST(
      makeRequest(validBody({ negativePrompt: 'low quality', resolution: '2K' })) as never,
    );
    const input = estimateImageGenMock.mock.calls[0]![1];
    expect(input.negativePrompt).toBe('low quality');
    expect(input.resolution).toBe('2K');
  });

  it('omits negativePrompt and resolution when not provided', async () => {
    await POST(makeRequest(validBody()) as never);
    const input = estimateImageGenMock.mock.calls[0]![1];
    expect(input).not.toHaveProperty('negativePrompt');
    expect(input).not.toHaveProperty('resolution');
  });

  it('skips getPublicUrls and omits images when referenceAssetIds is empty', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: [] })) as never);
    expect(getPublicUrlsMock).not.toHaveBeenCalled();
    expect(estimateImageGenMock.mock.calls[0]![1]).not.toHaveProperty('images');
  });

  it('returns 0 when orchestrator omits cost.total', async () => {
    estimateImageGenMock.mockResolvedValueOnce({
      id: 'wf_estimate',
      status: 'unassigned',
      cost: {},
    });
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estimatedBuzz: 0 });
  });

  it('returns 0 when orchestrator omits cost entirely', async () => {
    estimateImageGenMock.mockResolvedValueOnce({
      id: 'wf_estimate',
      status: 'unassigned',
    });
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estimatedBuzz: 0 });
  });

  it('re-throws non-OrchestratorError so upstream sees the failure', async () => {
    estimateImageGenMock.mockRejectedValueOnce(new Error('boom'));
    await expect(POST(makeRequest(validBody()) as never)).rejects.toThrow('boom');
  });

  it('rejects when referenceAssetIds exceeds max of 4', async () => {
    const res = await POST(
      makeRequest(validBody({ referenceAssetIds: ['a', 'b', 'c', 'd', 'e'] })) as never,
    );
    expect(res.status).toBe(400);
    expect(estimateImageGenMock).not.toHaveBeenCalled();
  });

  it('rejects numImages outside 1..4', async () => {
    const tooMany = await POST(makeRequest(validBody({ numImages: 5 })) as never);
    expect(tooMany.status).toBe(400);
    const zero = await POST(makeRequest(validBody({ numImages: 0 })) as never);
    expect(zero.status).toBe(400);
    expect(estimateImageGenMock).not.toHaveBeenCalled();
  });

  it('rejects unknown aspectRatio', async () => {
    const res = await POST(makeRequest(validBody({ aspectRatio: '2:3' })) as never);
    expect(res.status).toBe(400);
    expect(estimateImageGenMock).not.toHaveBeenCalled();
  });

  it('rejects prompt longer than max chars', async () => {
    const huge = 'x'.repeat(4001);
    const res = await POST(makeRequest(validBody({ prompt: huge })) as never);
    expect(res.status).toBe(400);
    expect(estimateImageGenMock).not.toHaveBeenCalled();
  });
});
