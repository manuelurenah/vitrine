import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getDefaultBrandMock } = vi.hoisted(() => ({ getDefaultBrandMock: vi.fn() }));
const { getPublicUrlsMock } = vi.hoisted(() => ({ getPublicUrlsMock: vi.fn() }));
const { estimateImageGenMock } = vi.hoisted(() => ({ estimateImageGenMock: vi.fn() }));
const { submitImageGenMock } = vi.hoisted(() => ({ submitImageGenMock: vi.fn() }));
const { createCampaignMock } = vi.hoisted(() => ({ createCampaignMock: vi.fn() }));
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
vi.mock('@/lib/campaigns', () => ({ createCampaign: createCampaignMock }));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/campaigns/cook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Spring drop',
    description: 'A campaign description for spring',
    goal: 'awareness',
    offer: '20% off',
    prompt: 'launch our new product line',
    audience: 'young pros',
    aesthetics: 'pastel',
    presetIds: ['ig-feed', 'ig-story'],
    referenceAssetIds: [],
    variantsPerPreset: 2,
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
    cost: { total: 5 },
  });
  createCampaignMock.mockImplementation(async (input: { tiles: Array<{ workflowId: string; presetId: string }> }) => ({
    id: 'camp_1',
    tiles: input.tiles.map((t, i) => ({
      id: `tile_${i}`,
      presetId: t.presetId,
      workflowId: t.workflowId,
    })),
  }));
  recordGenerationMock.mockResolvedValue({});
  recordBuzzEventMock.mockResolvedValue({});
});

describe('POST /api/campaigns/cook', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid brief', async () => {
    const res = await POST(makeRequest({ title: '', presetIds: [] }) as never);
    expect(res.status).toBe(400);
  });

  it('submits one workflow per preset with quantity = variantsPerPreset', async () => {
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(submitImageGenMock).toHaveBeenCalledTimes(2);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(2);
    }
  });

  it('persists campaign with referenceAssetIds, variantsPerPreset, enhancedPrompts, tiles', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['a1', 'a2'], variantsPerPreset: 3 })) as never);
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    const input = createCampaignMock.mock.calls[0]![0];
    expect(input.referenceAssetIds).toEqual(['a1', 'a2']);
    expect(input.variantsPerPreset).toBe(3);
    expect(input.enhancedPrompts).toBeDefined();
    expect(input.enhancedPrompts['ig-feed']).toBeDefined();
    expect(input.enhancedPrompts['ig-story']).toBeDefined();
    expect(input.tiles).toHaveLength(2);
    for (const t of input.tiles) {
      expect(t.quantity).toBe(3);
      expect(typeof t.workflowId).toBe('string');
      expect(typeof t.prompt).toBe('string');
    }
  });

  it('reference URLs land in images[] on the orchestrator body', async () => {
    await POST(makeRequest(validBody({ referenceAssetIds: ['ref1'] })) as never);
    expect(getPublicUrlsMock).toHaveBeenCalledWith(expect.any(String), ['ref1']);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].images).toEqual(['https://cdn.test/ref1']);
    }
  });

  it('omits images when no references provided', async () => {
    await POST(makeRequest(validBody()) as never);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].images).toBeUndefined();
    }
  });

  it('userOverride replaces finalPrompt for that preset only', async () => {
    const body = validBody({
      presetIds: ['ig-feed', 'ig-story'],
      enhancedPrompts: {
        'ig-feed': {
          finalPrompt: 'auto-built prompt for feed',
          negativePrompt: '',
          aspectRatio: '4:5',
          userOverride: 'MY CUSTOM OVERRIDE PROMPT',
        },
        'ig-story': {
          finalPrompt: 'auto-built prompt for story',
          negativePrompt: '',
          aspectRatio: '9:16',
        },
      },
    });
    await POST(makeRequest(body) as never);
    const prompts = submitImageGenMock.mock.calls.map((c) => c[1].prompt);
    expect(prompts).toContain('MY CUSTOM OVERRIDE PROMPT');
    expect(prompts).toContain('auto-built prompt for story');
    expect(prompts).not.toContain('auto-built prompt for feed');
  });

  it('uses provided enhancedPrompts.finalPrompt when no override', async () => {
    const body = validBody({
      presetIds: ['ig-feed'],
      enhancedPrompts: {
        'ig-feed': {
          finalPrompt: 'preview prompt for feed',
          negativePrompt: 'low quality',
          aspectRatio: '4:5',
        },
      },
    });
    await POST(makeRequest(body) as never);
    expect(submitImageGenMock.mock.calls[0]![1].prompt).toBe('preview prompt for feed');
    expect(submitImageGenMock.mock.calls[0]![1].aspectRatio).toBe('4:5');
    expect(submitImageGenMock.mock.calls[0]![1].negativePrompt).toBe('low quality');
  });

  it('builds prompt from scratch when enhancedPrompts absent', async () => {
    await POST(makeRequest(validBody({ presetIds: ['ig-feed'] })) as never);
    const prompt = submitImageGenMock.mock.calls[0]![1].prompt;
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    // The builder includes the description text
    expect(prompt).toContain('A campaign description for spring');
  });

  it('records one estimate buzz event + one generation per submitted tile', async () => {
    // Cook only emits `kind: estimate` — the real `submit` event is recorded
    // by the workflow polling endpoint when the workflow charges complete.
    await POST(makeRequest(validBody()) as never);
    expect(recordGenerationMock).toHaveBeenCalledTimes(2);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(2);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(['estimate', 'estimate']);
  });

  it('partial failure: one preset throws, others persist + response notes partial', async () => {
    submitImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    // Second call succeeds (mock default)
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaignId).toBe('camp_1');
    expect(json.partial).toBeDefined();
    expect(json.partial).toHaveLength(1);
    expect(json.partial[0].error).toBe('orchestrator_error');
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    expect(createCampaignMock.mock.calls[0]![0].tiles).toHaveLength(1);
  });

  it('total failure: all submits fail → 402 with all_submits_failed body, no DB writes', async () => {
    submitImageGenMock.mockRejectedValue(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('all_submits_failed');
    expect(json.failures).toHaveLength(2);
    expect(createCampaignMock).not.toHaveBeenCalled();
    expect(recordBuzzEventMock).not.toHaveBeenCalled();
  });

  it('does not reflect OrchestratorError body to client (no detail field)', async () => {
    submitImageGenMock.mockRejectedValue(
      new FakeOrchestratorError('boom', 402, { code: 'INTERNAL_TRACE_INFO' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    const json = await res.json();
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('INTERNAL_TRACE_INFO');
  });

  it('returns campaignId on success', async () => {
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ campaignId: 'camp_1' });
  });
});
