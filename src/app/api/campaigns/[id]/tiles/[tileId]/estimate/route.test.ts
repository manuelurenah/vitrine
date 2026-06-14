import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getDefaultBrandMock } = vi.hoisted(() => ({ getDefaultBrandMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { estimateImageGenMock } = vi.hoisted(() => ({ estimateImageGenMock: vi.fn() }));
const { getCampaignMock } = vi.hoisted(() => ({ getCampaignMock: vi.fn() }));

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
vi.mock('@/lib/campaigns', () => ({ getCampaign: getCampaignMock }));

import { POST } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/campaigns/c1/tiles/t1/estimate', {
    method: 'POST',
  });
}

function makeParams(id = 'c1', tileId = 't1') {
  return { params: Promise.resolve({ id, tileId }) };
}

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    userId: 'user_1',
    title: 'Spring',
    brief: {
      title: 'Spring',
      description: 'desc',
      goal: '',
      offer: '',
      prompt: 'launch',
    },
    presetIds: ['ig-feed'],
    referenceAssetIds: [],
    variantsPerPreset: 1,
    enhancedPrompts: null,
    tiles: [
      {
        id: 't1',
        presetId: 'ig-feed',
        workflowId: 'wf_old',
        status: 'done',
        prompt: 'old prompt',
        quantity: 1,
        adCopy: null,
        assetUrl: 'https://blob.test/current.jpg',
      },
    ],
    estimatedBuzz: 0,
    audience: null,
    aesthetics: null,
    createdAt: Date.now(),
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
  getDefaultBrandMock.mockResolvedValue({
    id: 'brand_1',
    name: 'Acme',
    palette: ['#111111'],
    logoUrl: 'https://cdn.test/logo.png',
  });
  getPublicUrlsMock.mockImplementation(async (_userId: string, ids: string[]) =>
    ids.map((id) => `https://cdn.test/${id}`),
  );
  estimateImageGenMock.mockResolvedValue({ cost: { total: 7 } });
  getCampaignMock.mockResolvedValue(makeCampaign());
});

describe('POST /api/campaigns/[id]/tiles/[tileId]/estimate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns the estimated cost', async () => {
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cost: 7 });
  });

  it('returns 404 when campaign not found', async () => {
    getCampaignMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('campaign_not_found');
  });

  it('returns 404 when tile not found', async () => {
    const res = await POST(makeRequest() as never, makeParams('c1', 'nope'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('tile_not_found');
  });

  it('propagates orchestrator error status', async () => {
    estimateImageGenMock.mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, {}));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('orchestrator_error');
  });
});
