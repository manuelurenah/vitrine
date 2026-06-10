import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getDefaultBrandMock } = vi.hoisted(() => ({ getDefaultBrandMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { submitImageGenMock } = vi.hoisted(() => ({ submitImageGenMock: vi.fn() }));
const { getCampaignMock } = vi.hoisted(() => ({ getCampaignMock: vi.fn() }));
const { swapTileWorkflowMock } = vi.hoisted(() => ({ swapTileWorkflowMock: vi.fn() }));
const { recordGenerationMock } = vi.hoisted(() => ({ recordGenerationMock: vi.fn() }));
const { recordBuzzEventMock } = vi.hoisted(() => ({ recordBuzzEventMock: vi.fn() }));

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
  submitImageGen: submitImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/campaigns', () => ({
  getCampaign: getCampaignMock,
  swapTileWorkflow: swapTileWorkflowMock,
}));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/campaigns/c1/tiles/t1/regenerate', {
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
  getDefaultBrandMock.mockResolvedValue(null);
  getPublicUrlsMock.mockImplementation(async (_userId: string, ids: string[]) =>
    ids.map((id) => `https://cdn.test/${id}`),
  );
  submitImageGenMock.mockResolvedValue({
    id: 'wf_new',
    status: 'pending',
    cost: { total: 5 },
  });
  swapTileWorkflowMock.mockResolvedValue({
    id: 't1',
    presetId: 'ig-feed',
    workflowId: 'wf_new',
    status: 'cooking',
    prompt: 'new',
    quantity: 1,
  });
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/campaigns/[id]/tiles/[tileId]/regenerate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when campaign not found', async () => {
    getCampaignMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('campaign_not_found');
  });

  it('returns 404 when tile not found', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign({ tiles: [] }));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('tile_not_found');
  });

  it('uses persisted enhancedPrompts when present', async () => {
    getCampaignMock.mockResolvedValueOnce(
      makeCampaign({
        enhancedPrompts: {
          'ig-feed': {
            base: 'b',
            brandLayer: '',
            styleLayer: '',
            finalPrompt: 'PERSISTED PROMPT',
            negativePrompt: 'bad',
            aspectRatio: '4:5',
          },
        },
      }),
    );
    await POST(makeRequest() as never, makeParams());
    const input = submitImageGenMock.mock.calls[0]![1];
    expect(input.prompt).toMatch(/^PERSISTED PROMPT · variation \d+$/);
    expect(input.aspectRatio).toBe('4:5');
    expect(input.negativePrompt).toBe('bad');
  });

  it('rebuilds prompt when enhancedPrompts absent', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign({ enhancedPrompts: null }));
    await POST(makeRequest() as never, makeParams());
    const input = submitImageGenMock.mock.calls[0]![1];
    expect(typeof input.prompt).toBe('string');
    expect(input.prompt).toMatch(/· variation \d+$/);
  });

  it('appends a variation hint suffix for diversity', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign());
    await POST(makeRequest() as never, makeParams());
    const input = submitImageGenMock.mock.calls[0]![1];
    expect(input.prompt).toMatch(/· variation \d+$/);
  });

  it('resolves campaign.referenceAssetIds into images[]', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign({ referenceAssetIds: ['a1', 'a2'] }));
    await POST(makeRequest() as never, makeParams());
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['a1', 'a2']);
    expect(submitImageGenMock.mock.calls[0]![1].images).toEqual([
      'https://cdn.test/a1',
      'https://cdn.test/a2',
    ]);
  });

  it('passes tile.quantity as numImages', async () => {
    getCampaignMock.mockResolvedValueOnce(
      makeCampaign({
        variantsPerPreset: 4,
        tiles: [
          {
            id: 't1',
            presetId: 'ig-feed',
            workflowId: 'wf_old',
            status: 'done',
            prompt: 'p',
            quantity: 4,
          },
        ],
      }),
    );
    await POST(makeRequest() as never, makeParams());
    expect(submitImageGenMock.mock.calls[0]![1].numImages).toBe(4);
  });

  it('calls swapTileWorkflow with the new workflow id', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign());
    await POST(makeRequest() as never, makeParams());
    expect(swapTileWorkflowMock).toHaveBeenCalledWith(
      'user_1',
      'c1',
      't1',
      'wf_new',
      expect.objectContaining({ prompt: expect.stringContaining('variation') }),
    );
  });

  it('records generation and a submit buzz event with note=regenerate', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign());
    await POST(makeRequest() as never, makeParams());
    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(1);
    expect(recordBuzzEventMock.mock.calls[0]![0].note).toBe('regenerate');
  });

  it('propagates orchestrator error', async () => {
    getCampaignMock.mockResolvedValueOnce(makeCampaign());
    submitImageGenMock.mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, {}));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(402);
  });
});
