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
  getPublicUrlsMock: vi.fn(async (_userId: string, ids: string[]) =>
    ids.map((id) => `https://cdn.test/${id}`),
  ),
}));
const { estimateImageGenMock } = vi.hoisted(() => ({
  estimateImageGenMock: vi.fn(
    async (_session: unknown, _input: { numImages: number; images?: string[] }) => ({
      id: 'wf',
      status: 'succeeded',
      cost: { total: 6 },
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
vi.mock('@/lib/assets', () => ({
  getPublicUrls: getPublicUrlsMock,
  MissingReferenceError: class MissingReferenceError extends Error {
    count: number;
    kind: 'assets' | 'products';
    constructor(count: number, kind: 'assets' | 'products') {
      super('missing');
      this.name = 'MissingReferenceError';
      this.count = count;
      this.kind = kind;
    }
  },
}));
vi.mock('@/lib/civitai', () => ({
  estimateImageGen: estimateImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/photoshoot/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    brief: {
      productName: 'Cold-brew bottle',
      productNotes: 'matte black aluminum, etched logo, 16oz',
      ratio: '4:5' as const,
      variantsPerTemplate: 3,
      templateIds: ['studio-clean', 'lifestyle-kitchen'],
    },
    templateIds: ['studio-clean', 'lifestyle-kitchen'],
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
    cost: { total: 6 },
  });
  recordBuzzEventMock.mockResolvedValue({} as never);
});

describe('POST /api/photoshoot/preview', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('not_authenticated');
  });

  it('returns 400 on invalid body', async () => {
    const res = await POST(makeRequest({ brief: { productName: '' }, templateIds: [] }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_body');
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/api/photoshoot/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('calls estimateImageGen once per template and sums totalBuzz', async () => {
    estimateImageGenMock
      .mockResolvedValueOnce({ id: 'a', status: 'succeeded', cost: { total: 10 } })
      .mockResolvedValueOnce({ id: 'b', status: 'succeeded', cost: { total: 12 } });

    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(estimateImageGenMock).toHaveBeenCalledTimes(2);
    expect(json.totalBuzz).toBe(22);
    expect(json.estimatePerPreset['studio-clean']).toBe(10);
    expect(json.estimatePerPreset['lifestyle-kitchen']).toBe(12);
    expect(json.enhancedPrompts['studio-clean']).toBeDefined();
  });

  it('does NOT record buzz events during preview', async () => {
    await POST(makeRequest(validBody()) as never);
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('passes numImages = brief.variantsPerTemplate', async () => {
    await POST(makeRequest(validBody()) as never);
    for (const call of estimateImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(3);
    }
  });

  it('passes resolved reference URLs when referenceAssetIds present', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['x1', 'x2'] })) as never);
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['x1', 'x2']);
    for (const call of estimateImageGenMock.mock.calls) {
      expect(call[1].images).toEqual(['https://cdn.test/x1', 'https://cdn.test/x2']);
    }
  });

  it('isolates per-template failures and reports them in errors map', async () => {
    estimateImageGenMock
      .mockResolvedValueOnce({ id: 'a', status: 'succeeded', cost: { total: 8 } })
      .mockRejectedValueOnce(new FakeOrchestratorError('boom', 500, {}));

    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.estimatePerPreset['studio-clean']).toBe(8);
    expect(json.estimatePerPreset['lifestyle-kitchen']).toBe(0);
    expect(json.totalBuzz).toBe(8);
    expect(json.errors['lifestyle-kitchen']).toContain('orchestrator_error:500');
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('returns 400 if a reference asset id is missing (no raw IDs leaked)', async () => {
    const { MissingReferenceError } = await import('@/lib/assets');
    getPublicUrlsMock.mockRejectedValueOnce(new MissingReferenceError(1, 'assets'));
    const res = await POST(makeRequest(validBody({ referenceAssetIds: ['ghost'] })) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_reference_assets');
    expect(JSON.stringify(json)).not.toContain('ghost');
  });
});
