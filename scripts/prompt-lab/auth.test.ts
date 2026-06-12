import { sealCookie } from '@civitai/app-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { needsRefresh, resolveAccessToken } from './auth';

const SECRET = 'a'.repeat(64);

const ENV_KEYS = ['PROMPT_LAB_SESSION', 'PROMPT_LAB_ACCESS_TOKEN', 'SESSION_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function sealedSession(expiresAt: number): string {
  return sealCookie(
    JSON.stringify({
      tokens: {
        access_token: 'real_access',
        refresh_token: 'real_refresh',
        token_type: 'Bearer',
        expires_at: expiresAt,
        scope: 0,
      },
      user: { id: 1, username: 'dev' },
    }),
    SECRET,
  );
}

describe('needsRefresh', () => {
  it('false when token is comfortably in the future', () => {
    expect(needsRefresh(1_000_000, 0)).toBe(false);
  });
  it('true when within the 30s skew window', () => {
    expect(needsRefresh(20_000, 0)).toBe(true);
  });
  it('true when already expired', () => {
    expect(needsRefresh(0, 1_000)).toBe(true);
  });
});

describe('resolveAccessToken', () => {
  it('returns the unsealed access token when not near expiry', async () => {
    process.env.PROMPT_LAB_SESSION = sealedSession(Date.now() + 60 * 60 * 1000);
    await expect(resolveAccessToken()).resolves.toBe('real_access');
  });

  it('honors the raw-token fallback as-is', async () => {
    process.env.PROMPT_LAB_ACCESS_TOKEN = 'raw_tok';
    await expect(resolveAccessToken()).resolves.toBe('raw_tok');
  });

  it('throws a clear error when no credential is set', async () => {
    await expect(resolveAccessToken()).rejects.toThrow(/PROMPT_LAB_SESSION/);
  });
});
