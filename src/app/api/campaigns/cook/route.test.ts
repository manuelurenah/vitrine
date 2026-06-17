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
const { generateAdCopyForPresetsMock } = vi.hoisted(() => ({
  generateAdCopyForPresetsMock: vi.fn(),
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
vi.mock('@/lib/civitai', async () => {
  // The cook route fans submits out through `mapWithConcurrency`. We mock the
  // submit but keep the REAL bounded-concurrency runner so order-preservation +
  // the success/failure partition behave exactly as in production. There is no
  // retry: failed submits are persisted as `failed` tiles (a retry could
  // double-charge Buzz).
  const { mapWithConcurrency } = await vi.importActual<typeof import('@/lib/concurrency')>(
    '@/lib/concurrency',
  );
  return {
    estimateImageGen: estimateImageGenMock,
    submitImageGen: submitImageGenMock,
    mapWithConcurrency,
    OrchestratorError: FakeOrchestratorError,
  };
});
vi.mock('@/lib/campaigns', () => ({ createCampaign: createCampaignMock }));
vi.mock('@/lib/generations', () => ({ recordGeneration: recordGenerationMock }));
vi.mock('@/lib/buzz', () => ({ recordBuzzEvent: recordBuzzEventMock }));
vi.mock('@/lib/adCopy', () => ({ generateAdCopyForPresets: generateAdCopyForPresetsMock }));

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
  generateAdCopyForPresetsMock.mockImplementation(
    async ({ presetIds }: { presetIds: string[] }) => {
      const out: Record<string, { headline: string; subhead: string; cta?: string }> = {};
      for (const id of presetIds) out[id] = { headline: `H ${id}`, subhead: `S ${id}`, cta: 'Buy' };
      return out;
    },
  );
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
  createCampaignMock.mockImplementation(
    async (input: { tiles: Array<{ workflowId: string; presetId: string }> }) => ({
      id: 'camp_1',
      tiles: input.tiles.map((t, i) => ({
        id: `tile_${i}`,
        presetId: t.presetId,
        workflowId: t.workflowId,
      })),
    }),
  );
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

  it('submits one workflow per variant (P × N) with numImages = 1', async () => {
    // validBody: 2 presets, variantsPerPreset: 2 → 4 submits.
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(submitImageGenMock).toHaveBeenCalledTimes(4);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(1);
    }
  });

  it('persists campaign with referenceAssetIds, variantsPerPreset, enhancedPrompts, tiles', async () => {
    await POST(
      makeRequest(validBody({ referenceAssetIds: ['a1', 'a2'], variantsPerPreset: 3 })) as never,
    );
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    const input = createCampaignMock.mock.calls[0]![0];
    expect(input.referenceAssetIds).toEqual(['a1', 'a2']);
    expect(input.variantsPerPreset).toBe(3);
    expect(input.enhancedPrompts).toBeDefined();
    expect(input.enhancedPrompts['ig-feed']).toBeDefined();
    expect(input.enhancedPrompts['ig-story']).toBeDefined();

    // 2 presets × 3 variants = 6 tile entries, each quantity 1.
    expect(input.tiles).toHaveLength(6);
    for (const t of input.tiles) {
      expect(t.quantity).toBe(1);
      expect(typeof t.workflowId).toBe('string');
      expect(typeof t.prompt).toBe('string');
      expect(typeof t.variantGroupId).toBe('string');
      expect(t.variantGroupId).toBeTruthy();
      expect(typeof t.variantIndex).toBe('number');
    }

    // Tiles of the same preset share one variant_group_id; variant_index covers 0..N-1.
    const byPreset = new Map<string, Array<{ variantGroupId: string; variantIndex: number }>>();
    for (const t of input.tiles) {
      const arr = byPreset.get(t.presetId) ?? [];
      arr.push({ variantGroupId: t.variantGroupId, variantIndex: t.variantIndex });
      byPreset.set(t.presetId, arr);
    }
    expect([...byPreset.keys()].sort()).toEqual(['ig-feed', 'ig-story']);
    for (const arr of byPreset.values()) {
      expect(arr).toHaveLength(3);
      expect(new Set(arr.map((x) => x.variantGroupId)).size).toBe(1);
      expect(arr.map((x) => x.variantIndex).sort()).toEqual([0, 1, 2]);
    }
    // Different presets get different group ids.
    const groupIds = [...byPreset.values()].map((arr) => arr[0]!.variantGroupId);
    expect(new Set(groupIds).size).toBe(2);
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
    // The override is honored verbatim for ig-feed…
    expect(prompts).toContain('MY CUSTOM OVERRIDE PROMPT');
    // …while ig-story (no override) is rebuilt with copy directives, so neither
    // copy-less preview finalPrompt is submitted.
    expect(prompts).not.toContain('auto-built prompt for story');
    expect(prompts).not.toContain('auto-built prompt for feed');
    expect(prompts.some((p: string) => p.includes('render the headline'))).toBe(true);
  });

  it('rebuilds with copy directives (discarding the copy-less preview prompt) when no override', async () => {
    const body = validBody({
      presetIds: ['ig-feed'],
      enhancedPrompts: {
        'ig-feed': {
          finalPrompt: 'preview prompt for feed, no text overlay',
          negativePrompt: 'low quality',
          aspectRatio: '4:5',
        },
      },
    });
    await POST(makeRequest(body) as never);
    const submitted = submitImageGenMock.mock.calls[0]![1];
    // adCopy is generated (validBody supplies none) → copy directives injected,
    // and the preview's copy-less finalPrompt is not submitted.
    expect(submitted.prompt).not.toBe('preview prompt for feed, no text overlay');
    expect(submitted.prompt).toContain('render the headline');
    expect(submitted.aspectRatio).toBe('4:5');
    expect(submitted.negativePrompt).toContain('misspelled text');
  });

  it('builds prompt from scratch when enhancedPrompts absent', async () => {
    await POST(makeRequest(validBody({ presetIds: ['ig-feed'] })) as never);
    const prompt = submitImageGenMock.mock.calls[0]![1].prompt;
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    // The builder includes the description text
    expect(prompt).toContain('A campaign description for spring');
  });

  it('injects copy directives into the submitted prompt even when client enhancedPrompts omit them', async () => {
    // Real wizard payload: /preview builds copy-less enhancedPrompts (it never
    // sees adCopy), and adCopy is sent alongside. The submitted prompt MUST
    // carry the headline/subhead/CTA render directives — otherwise the model
    // bakes no text and the user has to hit "fix layout". Regression guard for
    // the cook-vs-regenerate inconsistency.
    const body = validBody({
      presetIds: ['ig-feed'],
      enhancedPrompts: {
        'ig-feed': {
          finalPrompt: 'product hero shot, no text overlay',
          negativePrompt: 'low quality',
          aspectRatio: '4:5',
        },
      },
      adCopy: {
        'ig-feed': { headline: 'CLARITY BOTTLED', subhead: 'wakes your skin up', cta: 'Shop now' },
      },
    });
    await POST(makeRequest(body) as never);
    const submitted = submitImageGenMock.mock.calls[0]![1];
    expect(submitted.prompt).toContain('CLARITY BOTTLED'); // headline baked in
    expect(submitted.prompt).toContain('render the headline'); // copyLayer directive present
    expect(submitted.prompt).not.toContain('no text overlay'); // copy-less preview prompt discarded
    expect(submitted.negativePrompt).toContain('misspelled text'); // text-aware negative used
  });

  it('records one estimate buzz event + one generation per submitted tile', async () => {
    // Cook only emits `kind: estimate` — the real `submit` event is recorded
    // by the workflow polling endpoint when the workflow charges complete.
    // validBody: 2 presets × 2 variants = 4 submitted variant tiles.
    await POST(makeRequest(validBody()) as never);
    expect(recordGenerationMock).toHaveBeenCalledTimes(4);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(4);
    const kinds = recordBuzzEventMock.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(['estimate', 'estimate', 'estimate', 'estimate']);
  });

  it('partial failure: one variant submit throws, others persist + response notes partial', async () => {
    // Only the FIRST of the 4 (2 presets × 2 variants) submits rejects; the
    // other 3 succeed. We persist ALL 4 requested variants — the 3 successes as
    // cooking tiles, the 1 failure as a `failed` tile the user can regenerate
    // (we deliberately do NOT retry, which could double-charge Buzz).
    submitImageGenMock.mockRejectedValueOnce(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaignId).toBe('camp_1');
    expect(json.partial).toBeDefined();
    expect(json.partial).toHaveLength(1);
    expect(json.partial[0].error).toBe('orchestrator_error');
    expect(createCampaignMock).toHaveBeenCalledTimes(1);

    // All 4 requested variants are persisted: 3 cooking + 1 failed.
    const tiles = createCampaignMock.mock.calls[0]![0].tiles as Array<{
      workflowId: string | null;
      status?: string;
      error?: string | null;
    }>;
    expect(tiles).toHaveLength(4);
    const cooking = tiles.filter((t) => t.status === 'cooking');
    const failed = tiles.filter((t) => t.status === 'failed');
    expect(cooking).toHaveLength(3);
    expect(failed).toHaveLength(1);
    // Successful tiles carry a real workflow id; failed tiles carry none.
    for (const t of cooking) expect(typeof t.workflowId).toBe('string');
    expect(failed[0]!.workflowId).toBeNull();
    expect(failed[0]!.error).toBe('orchestrator_error');

    // Audit rows are written ONLY for the 3 successes — a failed tile has no
    // workflow, so charging it (generation + buzz) would be wrong.
    expect(recordGenerationMock).toHaveBeenCalledTimes(3);
    expect(recordBuzzEventMock).toHaveBeenCalledTimes(3);
    // None of the audit writes reference a null workflow id.
    for (const call of recordGenerationMock.mock.calls) {
      expect(typeof call[0].workflowId).toBe('string');
    }
    for (const call of recordBuzzEventMock.mock.calls) {
      expect(typeof call[0].workflowId).toBe('string');
    }
  });

  it('total failure: all submits fail → 402 with all_submits_failed body, no DB writes', async () => {
    submitImageGenMock.mockRejectedValue(
      new FakeOrchestratorError('insufficient buzz', 402, { code: 'NO_BUZZ' }),
    );
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('all_submits_failed');
    expect(json.failures).toHaveLength(4);
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
