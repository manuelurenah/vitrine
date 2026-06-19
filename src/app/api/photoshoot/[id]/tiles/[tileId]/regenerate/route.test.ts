import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getDefaultBrandMock } = vi.hoisted(() => ({ getDefaultBrandMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { submitImageGenMock } = vi.hoisted(() => ({ submitImageGenMock: vi.fn() }));
const { getPhotoshootMock } = vi.hoisted(() => ({ getPhotoshootMock: vi.fn() }));
const { swapPhotoshootTileWorkflowMock } = vi.hoisted(() => ({
  swapPhotoshootTileWorkflowMock: vi.fn(),
}));
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
vi.mock('@/lib/photoshoots', () => ({
  getPhotoshoot: getPhotoshootMock,
  swapPhotoshootTileWorkflow: swapPhotoshootTileWorkflowMock,
}));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));
// Rate limiter is DB-backed; mock it OPEN so route tests don't hit the real
// dev `rate_limits` table (counter would persist across runs → spurious 429s).
vi.mock('@/lib/rateLimitGuard', () => ({ rateLimitOr429: vi.fn().mockResolvedValue(null) }));

import { POST } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/photoshoot/p1/tiles/t1/regenerate', {
    method: 'POST',
  });
}

function makeParams(id = 'p1', tileId = 't1') {
  return { params: Promise.resolve({ id, tileId }) };
}

function makeShoot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    userId: 'user_1',
    title: 'Hot Sauce',
    brief: {
      productName: 'Hot Sauce',
      productNotes: 'spicy red bottle',
      ratio: '4:5' as const,
      variantsPerTemplate: 1,
      templateIds: ['studio-clean'],
    },
    referenceAssetIds: [],
    enhancedPrompts: null,
    tiles: [
      {
        id: 't1',
        templateId: 'studio-clean',
        variantIndex: 0,
        workflowId: 'wf_old',
        status: 'done',
        prompt: 'old prompt',
        quantity: 1,
      },
    ],
    estimatedBuzz: 0,
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
  swapPhotoshootTileWorkflowMock.mockResolvedValue({
    id: 't1',
    templateId: 'studio-clean',
    variantIndex: 0,
    workflowId: 'wf_new',
    status: 'cooking',
    prompt: 'new',
    quantity: 1,
  });
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/photoshoot/[id]/tiles/[tileId]/regenerate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when photoshoot not found', async () => {
    getPhotoshootMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('photoshoot_not_found');
  });

  it('returns 404 when tile not found', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot({ tiles: [] }));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('tile_not_found');
  });

  it('uses persisted enhancedPrompts when present', async () => {
    getPhotoshootMock.mockResolvedValueOnce(
      makeShoot({
        enhancedPrompts: {
          'studio-clean': {
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
    getPhotoshootMock.mockResolvedValueOnce(makeShoot({ enhancedPrompts: null }));
    await POST(makeRequest() as never, makeParams());
    const input = submitImageGenMock.mock.calls[0]![1];
    expect(typeof input.prompt).toBe('string');
    expect(input.prompt).toMatch(/· variation \d+$/);
  });

  it('appends a variation hint suffix for diversity', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot());
    await POST(makeRequest() as never, makeParams());
    const input = submitImageGenMock.mock.calls[0]![1];
    expect(input.prompt).toMatch(/· variation \d+$/);
  });

  it('resolves shoot.referenceAssetIds into images[]', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot({ referenceAssetIds: ['a1', 'a2'] }));
    await POST(makeRequest() as never, makeParams());
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['a1', 'a2']);
    expect(submitImageGenMock.mock.calls[0]![1].images).toEqual([
      'https://cdn.test/a1',
      'https://cdn.test/a2',
    ]);
  });

  it('passes tile.quantity as numImages', async () => {
    getPhotoshootMock.mockResolvedValueOnce(
      makeShoot({
        tiles: [
          {
            id: 't1',
            templateId: 'studio-clean',
            variantIndex: 0,
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

  it('calls swapPhotoshootTileWorkflow with the new workflow id', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot());
    await POST(makeRequest() as never, makeParams());
    expect(swapPhotoshootTileWorkflowMock).toHaveBeenCalledWith('user_1', 'p1', 't1', 'wf_new');
  });

  it('records generation and a submit buzz event with note=regenerate', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot());
    await POST(makeRequest() as never, makeParams());
    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    expect(recordGenerationMock.mock.calls[0]![0].source).toBe('photoshoot');
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(1);
    expect(recordBuzzEventMock.mock.calls[0]![0].note).toBe('regenerate');
  });

  it('propagates orchestrator error', async () => {
    getPhotoshootMock.mockResolvedValueOnce(makeShoot());
    submitImageGenMock.mockRejectedValueOnce(new FakeOrchestratorError('boom', 402, {}));
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(402);
  });
});
