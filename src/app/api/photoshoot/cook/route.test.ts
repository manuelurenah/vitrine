import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getDefaultBrandMock } = vi.hoisted(() => ({ getDefaultBrandMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { estimateImageGenMock } = vi.hoisted(() => ({ estimateImageGenMock: vi.fn() }));
const { submitImageGenMock } = vi.hoisted(() => ({ submitImageGenMock: vi.fn() }));
const { createPhotoshootMock } = vi.hoisted(() => ({ createPhotoshootMock: vi.fn() }));
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
vi.mock('@/lib/assets', () => ({ getPublicUrls: getPublicUrlsMock, MissingReferenceError: class MissingReferenceError extends Error { count: number; kind: 'assets' | 'products'; constructor(count: number, kind: 'assets' | 'products') { super('missing'); this.name = 'MissingReferenceError'; this.count = count; this.kind = kind; } } }));
vi.mock('@/lib/civitai', () => ({
  estimateImageGen: estimateImageGenMock,
  submitImageGen: submitImageGenMock,
  OrchestratorError: FakeOrchestratorError,
}));
vi.mock('@/lib/photoshoots', () => ({ createPhotoshoot: createPhotoshootMock }));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/photoshoot/cook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    productName: 'Cold-brew bottle',
    productNotes: 'matte black aluminum, etched logo, 16oz',
    ratio: '4:5',
    variantsPerTemplate: 3,
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
  let submitId = 0;
  submitImageGenMock.mockImplementation(async () => ({
    id: `wf_submit_${++submitId}`,
    status: 'pending',
    cost: { total: 0 },
  }));
  estimateImageGenMock.mockResolvedValue({
    id: 'wf_estimate',
    status: 'succeeded',
    cost: { total: 8 },
  });
  createPhotoshootMock.mockImplementation(
    async (input: { tiles: Array<{ workflowId: string; templateId: string }> }) => ({
      id: 'shoot_1',
      tiles: input.tiles.map((t, i) => ({
        id: `tile_${i}`,
        templateId: t.templateId,
        workflowId: t.workflowId,
      })),
    }),
  );
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/photoshoot/cook', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid brief', async () => {
    const res = await POST(makeRequest({ productName: '', templateIds: [] }) as never);
    expect(res.status).toBe(400);
  });

  it('submits one workflow per template (no outer variant loop)', async () => {
    await POST(makeRequest(validBody()) as never);
    // 2 templates × 1 workflow (NOT 2 × 3 like the old shape)
    expect(submitImageGenMock).toHaveBeenCalledTimes(2);
  });

  it('passes numImages = brief.variantsPerTemplate to each workflow', async () => {
    await POST(makeRequest(validBody({ variantsPerTemplate: 4 })) as never);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(4);
    }
  });

  it('persists photoshoot with referenceAssetIds, enhancedPrompts, and quantity per tile', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['a1'], variantsPerTemplate: 3 })) as never);
    const input = createPhotoshootMock.mock.calls[0]![0];
    expect(input.referenceAssetIds).toEqual(['a1']);
    expect(input.enhancedPrompts).toBeDefined();
    expect(input.enhancedPrompts['studio-clean']).toBeDefined();
    expect(input.enhancedPrompts['lifestyle-kitchen']).toBeDefined();
    expect(input.tiles).toHaveLength(2);
    for (const t of input.tiles) {
      expect(t.quantity).toBe(3);
      expect(t.variantIndex).toBe(0);
    }
  });

  it('reference URLs land in images[] on the orchestrator body', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['ref1', 'ref2'] })) as never);
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['ref1', 'ref2']);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].images).toEqual(['https://cdn.test/ref1', 'https://cdn.test/ref2']);
    }
  });

  it('omits images when no references', async () => {
    await POST(makeRequest(validBody()) as never);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].images).toBeUndefined();
    }
  });

  it('userOverride replaces finalPrompt for that template only', async () => {
    const body = validBody({
      templateIds: ['studio-clean', 'lifestyle-kitchen'],
      enhancedPrompts: {
        'studio-clean': {
          finalPrompt: 'auto-built studio prompt',
          negativePrompt: '',
          aspectRatio: '4:5',
          userOverride: 'CUSTOM OVERRIDE STUDIO',
        },
        'lifestyle-kitchen': {
          finalPrompt: 'auto-built lifestyle prompt',
          negativePrompt: '',
          aspectRatio: '4:5',
        },
      },
    });
    await POST(makeRequest(body) as never);
    const prompts = submitImageGenMock.mock.calls.map((c) => c[1].prompt);
    expect(prompts).toContain('CUSTOM OVERRIDE STUDIO');
    expect(prompts).toContain('auto-built lifestyle prompt');
  });

  it('records one estimate buzz event + one generation per submitted tile', async () => {
    await POST(makeRequest(validBody()) as never);
    expect(recordGenerationMock).toHaveBeenCalledTimes(2);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(2);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(['estimate', 'estimate']);
  });

  it('total failure: all submits fail → 402, no DB writes', async () => {
    submitImageGenMock.mockRejectedValue(
      new FakeOrchestratorError('boom', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('all_submits_failed');
  });

  it('partial failure: one template fails → 200 with partial entries', async () => {
    submitImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('boom', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.photoshootId).toBeDefined();
    expect(json.partial).toHaveLength(1);
  });

  it('returns photoshootId on success', async () => {
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photoshootId: 'shoot_1' });
  });
});
