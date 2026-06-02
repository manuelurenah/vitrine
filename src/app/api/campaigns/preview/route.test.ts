import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));
const { getUserKeyMock } = vi.hoisted(() => ({
  getUserKeyMock: vi.fn(async () => 'user_1'),
}));
const { getDefaultBrandMock } = vi.hoisted(() => ({
  getDefaultBrandMock: vi.fn(async () => null),
}));
const { getPublicUrlsMock } = vi.hoisted(() => ({
  getPublicUrlsMock: vi.fn(async (_userId: string, ids: string[]) => ids.map((id) => `https://cdn.test/${id}`)),
}));
const { estimateImageGenMock } = vi.hoisted(() => ({
  estimateImageGenMock: vi.fn(
    async (_session: unknown, _input: { numImages: number; images?: string[] }) => ({
      id: 'wf',
      status: 'succeeded',
      cost: { total: 5 },
    }),
  ),
}));
const { recordBuzzEventMock } = vi.hoisted(() => ({
  recordBuzzEventMock: vi.fn(async (_input: Record<string, unknown>) => ({})),
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

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/brand', () => ({ getDefaultBrand: getDefaultBrandMock }));
vi.mock('@/lib/assets', () => ({ getPublicUrls: getPublicUrlsMock, MissingReferenceError: class MissingReferenceError extends Error { count: number; kind: 'assets' | 'products'; constructor(count: number, kind: 'assets' | 'products') { super('missing'); this.name = 'MissingReferenceError'; this.count = count; this.kind = kind; } } }));
vi.mock('@/lib/civitai', () => ({
  estimateImageGen: estimateImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/campaigns/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    brief: {
      title: 'Spring drop',
      description: 'Launch campaign for spring product',
      goal: 'awareness',
      offer: '20% off',
      prompt: '',
      audience: 'young pros',
      aesthetics: 'pastel',
    },
    presetIds: ['ig-feed', 'ig-story'],
    variantsPerPreset: 2,
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
  getDefaultBrandMock.mockResolvedValue(null);
  getPublicUrlsMock.mockImplementation(async (_userId: string, ids: string[]) =>
    ids.map((id) => `https://cdn.test/${id}`),
  );
  estimateImageGenMock.mockResolvedValue({
    id: 'wf',
    status: 'succeeded',
    cost: { total: 5 },
  });
  recordBuzzEventMock.mockResolvedValue({} as never);
});

describe('POST /api/campaigns/preview', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('not_authenticated');
  });

  it('returns 400 on invalid body', async () => {
    const res = await POST(
      makeRequest({ brief: { title: '' }, presetIds: [], variantsPerPreset: 0 }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_body');
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/api/campaigns/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('calls estimateImageGen once per preset and sums totalBuzz', async () => {
    estimateImageGenMock
      .mockResolvedValueOnce({ id: 'a', status: 'succeeded', cost: { total: 7 } })
      .mockResolvedValueOnce({ id: 'b', status: 'succeeded', cost: { total: 9 } });

    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(estimateImageGenMock).toHaveBeenCalledTimes(2);
    expect(json.totalBuzz).toBe(16);
    expect(json.estimatePerPreset['ig-feed']).toBe(7);
    expect(json.estimatePerPreset['ig-story']).toBe(9);
    expect(json.enhancedPrompts['ig-feed']).toBeDefined();
    expect(json.enhancedPrompts['ig-story']).toBeDefined();
  });

  it('does NOT record buzz events during preview (whatif is free + stateless)', async () => {
    await POST(makeRequest(validBody()) as never);
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('passes numImages = variantsPerPreset to estimateImageGen', async () => {
    await POST(makeRequest(validBody({ variantsPerPreset: 4 })) as never);
    for (const call of estimateImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(4);
    }
  });

  it('passes resolved reference URLs when referenceAssetIds present', async () => {
    await POST(
      makeRequest(validBody({ referenceAssetIds: ['a1', 'a2'] })) as never,
    );
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['a1', 'a2']);
    for (const call of estimateImageGenMock.mock.calls) {
      expect(call[1].images).toEqual(['https://cdn.test/a1', 'https://cdn.test/a2']);
    }
  });

  it('omits images when no references provided', async () => {
    await POST(makeRequest(validBody()) as never);
    for (const call of estimateImageGenMock.mock.calls) {
      expect(call[1].images).toBeUndefined();
    }
  });

  it('isolates per-preset failures and reports them in errors map', async () => {
    estimateImageGenMock
      .mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, { code: 'NO_BUZZ' }))
      .mockResolvedValueOnce({ id: 'b', status: 'succeeded', cost: { total: 4 } });

    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.estimatePerPreset['ig-feed']).toBe(0);
    expect(json.estimatePerPreset['ig-story']).toBe(4);
    expect(json.totalBuzz).toBe(4);
    expect(json.errors['ig-feed']).toContain('orchestrator_error:402');
    expect(json.errors['ig-story']).toBeUndefined();
    // No buzz events recorded on preview — neither for success nor failure.
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('returns 400 if a reference asset id is missing (no raw IDs leaked)', async () => {
    // The route imports MissingReferenceError from @/lib/assets — use the
    // mocked class from the hoisted vi.mock above.
    const { MissingReferenceError } = await import('@/lib/assets');
    getPublicUrlsMock.mockRejectedValueOnce(new MissingReferenceError(1, 'assets'));
    const res = await POST(
      makeRequest(validBody({ referenceAssetIds: ['ghost'] })) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_reference_assets');
    expect(json.missing).toBe(1);
    expect(json.kind).toBe('assets');
    // Body must not contain the user-supplied UUID
    expect(JSON.stringify(json)).not.toContain('ghost');
  });
});
