import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real env module runs full createEnv() validation (Civitai/session vars)
// which isn't available in the unit-test environment. Mirror adCopy.test.ts and
// mock `./env` so we can deterministically drive the missing-key fallback path
// without any network. An empty OPENROUTER_API_KEY selects the local fallback.
vi.mock('./env', () => ({
  env: {
    OPENROUTER_API_KEY: '',
    OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
    OPENROUTER_MODEL: 'm1',
    OPENROUTER_MODELS: 'm1,m2,m3',
    NEXT_PUBLIC_APP_URL: 'http://localhost',
  },
}));

describe('generatePhotoshootDraft fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a template fallback when OPENROUTER_API_KEY is unset', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const { generatePhotoshootDraft } = await import('./photoshootDraft');
    const { draft, meta } = await generatePhotoshootDraft({
      prompt: 'cozy candle on a desk',
      productName: 'Amber Candle',
    });
    expect(meta.llm).toBe('fallback');
    expect(meta.reason).toBe('missing_api_key');
    expect(draft.prompt).toContain('cozy candle');
    expect(draft.title).toBe('Amber Candle');
    expect(draft.templateIds.length).toBeGreaterThan(0);
    const { PHOTOSHOOT_TEMPLATES } = await import('./photoshootTemplates');
    for (const id of draft.templateIds) expect(id in PHOTOSHOOT_TEMPLATES).toBe(true);
  });
});
