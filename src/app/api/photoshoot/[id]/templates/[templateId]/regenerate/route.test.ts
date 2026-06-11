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

import { POST } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/photoshoot/p1/templates/studio-clean/regenerate', {
    method: 'POST',
  });
}

function makeParams(id = 'p1', templateId = 'studio-clean') {
  return { params: Promise.resolve({ id, templateId }) };
}

function makeTile(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    templateId: 'studio-clean',
    variantIndex: 0,
    workflowId: 'wf_old',
    status: 'done',
    prompt: 'old prompt',
    quantity: 1,
    assetId: null,
    ...overrides,
  };
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
    tiles: [makeTile()],
    estimatedBuzz: 0,
    createdAt: Date.now(),
    thumbUrls: [],
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
  swapPhotoshootTileWorkflowMock.mockImplementation(
    async (_userId: string, _shootId: string, tileId: string, workflowId: string) => ({
      id: tileId,
      templateId: 'studio-clean',
      variantIndex: 0,
      workflowId,
      status: 'cooking',
      prompt: 'new',
      quantity: 1,
      assetId: null,
    }),
  );
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/photoshoot/[id]/templates/[templateId]/regenerate', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when photoshoot not found (wrong user / missing)', async () => {
    getPhotoshootMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('photoshoot_not_found');
  });

  it('returns 400 when templateId is not a valid PhotoshootTemplateId', async () => {
    const res = await POST(makeRequest() as never, makeParams('p1', 'not-a-real-template'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_template_id');
  });

  it('returns 404 when the shoot has no tiles for that templateId', async () => {
    getPhotoshootMock.mockResolvedValueOnce(
      makeShoot({ tiles: [makeTile({ templateId: 'studio-dark' })] }),
    );
    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('template_tiles_not_found');
  });

  it('happy path: 2 tiles in the target template → both get fresh workflow, status cooking, audit called per tile', async () => {
    getPhotoshootMock.mockResolvedValueOnce(
      makeShoot({
        tiles: [makeTile({ id: 't1', variantIndex: 0 }), makeTile({ id: 't2', variantIndex: 1 })],
      }),
    );
    submitImageGenMock
      .mockResolvedValueOnce({ id: 'wf_new_1', status: 'pending', cost: { total: 5 } })
      .mockResolvedValueOnce({ id: 'wf_new_2', status: 'pending', cost: { total: 5 } });
    swapPhotoshootTileWorkflowMock
      .mockResolvedValueOnce({
        id: 't1',
        templateId: 'studio-clean',
        variantIndex: 0,
        workflowId: 'wf_new_1',
        status: 'cooking',
        prompt: 'new',
        quantity: 1,
        assetId: null,
      })
      .mockResolvedValueOnce({
        id: 't2',
        templateId: 'studio-clean',
        variantIndex: 1,
        workflowId: 'wf_new_2',
        status: 'cooking',
        prompt: 'new',
        quantity: 1,
        assetId: null,
      });

    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tiles).toHaveLength(2);
    expect(body.tiles[0].status).toBe('cooking');
    expect(body.tiles[1].status).toBe('cooking');
    expect(body.partial).toBeUndefined();

    // Audit invariant: recordGeneration + recordBuzzEvent called once per submitted tile
    expect(recordGenerationMock).toHaveBeenCalledTimes(2);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(2);
    expect(recordGenerationMock.mock.calls[0]![0].source).toBe('photoshoot');
    expect(recordBuzzEventMock.mock.calls[0]![0].note).toBe('regenerate');
    expect(recordGenerationMock.mock.calls[1]![0].source).toBe('photoshoot');
    expect(recordBuzzEventMock.mock.calls[1]![0].note).toBe('regenerate');
  });

  it('partial failure: one tile submitImageGen rejects → partial array present, succeeded tile returned', async () => {
    getPhotoshootMock.mockResolvedValueOnce(
      makeShoot({
        tiles: [makeTile({ id: 't1', variantIndex: 0 }), makeTile({ id: 't2', variantIndex: 1 })],
      }),
    );
    // t1 succeeds, t2 rejects
    submitImageGenMock
      .mockResolvedValueOnce({ id: 'wf_new_1', status: 'pending', cost: { total: 5 } })
      .mockRejectedValueOnce(new FakeOrchestratorError('quota', 402, {}));
    swapPhotoshootTileWorkflowMock.mockResolvedValueOnce({
      id: 't1',
      templateId: 'studio-clean',
      variantIndex: 0,
      workflowId: 'wf_new_1',
      status: 'cooking',
      prompt: 'new',
      quantity: 1,
      assetId: null,
    });

    const res = await POST(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tiles).toHaveLength(1);
    expect(body.tiles[0].id).toBe('t1');
    expect(body.partial).toHaveLength(1);
    expect(body.partial[0].tileId).toBe('t2');

    // Audit only called for the succeeded tile
    expect(recordGenerationMock).toHaveBeenCalledTimes(1);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(1);
  });
});
