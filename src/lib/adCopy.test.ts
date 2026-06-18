import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the OpenAI client so we can script per-model responses.
const createMock = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: createMock } };
    constructor(_opts: unknown) {}
  },
}));

// Pin a deterministic 3-model chain and a present API key.
vi.mock('./env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
    OPENROUTER_MODEL: 'm1',
    OPENROUTER_MODELS: 'm1,m2,m3',
    NEXT_PUBLIC_APP_URL: 'http://localhost',
  },
}));

import { generateCampaignDraft } from './adCopy';
import type { PresetId } from './presets';

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

const VALID = JSON.stringify({
  brief: {
    title: 'Zap Season',
    description: 'A bite-free summer campaign for the countryside.',
    goal: 'drive online sales',
    offer: '2-for-1, online only',
    audience: 'rural families, 25–45',
    aesthetics: 'bold, high-contrast',
  },
  tiles: { 'ig-feed': { headline: 'Zap the bite', subhead: 'Sleep bite-free tonight', cta: 'Shop' } },
});

const input = {
  prompt: 'mosquito zapper v2 launch for the countryside',
  brand: null,
  presetIds: ['ig-feed'] as PresetId[],
};

beforeEach(() => {
  createMock.mockReset();
});

describe('generateCampaignDraft — model fallback chain', () => {
  it('advances to the next model when one returns empty content (the bug from the logs)', async () => {
    createMock
      .mockResolvedValueOnce(completion('')) // m1: 200 but empty → invalid_json
      .mockResolvedValueOnce(completion(VALID)); // m2: usable
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.llm).toBe('ok');
    expect(res.meta.model).toBe('m2');
    expect(res.meta.attempts).toEqual(['m1', 'm2']);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(res.draft.title).toBe('Zap Season');
  });

  it('advances past non-JSON output and lands on a later model', async () => {
    createMock
      .mockResolvedValueOnce(completion('Sure! Here is your campaign...')) // m1: prose
      .mockResolvedValueOnce(completion('still not json {nope')) // m2: broken
      .mockResolvedValueOnce(completion(VALID)); // m3: usable
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.llm).toBe('ok');
    expect(res.meta.model).toBe('m3');
    expect(res.meta.attempts).toEqual(['m1', 'm2', 'm3']);
  });

  it('advances when a model returns valid JSON of an unrecognised shape', async () => {
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify({ unexpected: 'payload' }))) // m1: shape miss
      .mockResolvedValueOnce(completion(VALID)); // m2: usable
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.model).toBe('m2');
    expect(res.meta.attempts).toEqual(['m1', 'm2']);
  });

  it('falls back to the local template only after exhausting every model', async () => {
    createMock.mockResolvedValue(completion('')); // every model returns empty
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.llm).toBe('fallback');
    expect(res.meta.attempts).toEqual(['m1', 'm2', 'm3']);
    expect(res.meta.reason).toBe('invalid_json');
    expect(createMock).toHaveBeenCalledTimes(3);
    // still returns a usable template draft so the UI never breaks
    expect(res.draft.adCopy['ig-feed']).toBeTruthy();
  });

  it('parses extraCopy spares into draft.copyPool, dropping malformed entries', async () => {
    const withPool = JSON.stringify({
      brief: {
        title: 'Zap Season',
        description: 'A bite-free summer campaign for the countryside.',
        goal: 'drive online sales',
        offer: '2-for-1, online only',
        audience: 'rural families, 25–45',
        aesthetics: 'bold, high-contrast',
      },
      tiles: {
        'ig-feed': { headline: 'Zap the bite', subhead: 'Sleep bite-free tonight', cta: 'Shop' },
      },
      extraCopy: [
        { headline: 'Outsmart mosquitoes', subhead: 'Two zappers, one price', cta: 'Buy' },
        { headline: 'Reclaim your evenings', subhead: 'Bite-free patios all summer' },
        { headline: 'missing subhead so dropped' }, // invalid → filtered out
      ],
    });
    createMock.mockResolvedValueOnce(completion(withPool));
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.llm).toBe('ok');
    expect(res.draft.copyPool).toHaveLength(2);
    expect(res.draft.copyPool[0]).toMatchObject({ headline: 'Outsmart mosquitoes', cta: 'Buy' });
    expect(res.draft.copyPool[1]).toMatchObject({ headline: 'Reclaim your evenings' });
  });

  it('yields an empty copyPool when the model omits extraCopy', async () => {
    createMock.mockResolvedValueOnce(completion(VALID));
    const res = await generateCampaignDraft({ ...input });
    expect(res.draft.copyPool).toEqual([]);
  });

  it('retries without JSON mode on response_format rejection, then advances if still unusable', async () => {
    createMock
      .mockRejectedValueOnce(new Error('response_format is not supported')) // m1 try1
      .mockResolvedValueOnce(completion('')) // m1 try2 (no JSON mode): empty → advance
      .mockResolvedValueOnce(completion(VALID)); // m2: usable
    const res = await generateCampaignDraft({ ...input });
    expect(res.meta.model).toBe('m2');
    expect(res.meta.attempts).toEqual(['m1', 'm2']);
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
