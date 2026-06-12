import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type OAuthTokens,
  refreshToken as oauthRefresh,
  unsealCookie,
} from '@civitai/app-sdk';

const CACHE_PATH = '.auth/prompt-lab.json';
const SKEW_MS = 30_000; // keep in sync with the 30_000 skew in src/lib/session.ts
const DEFAULT_CIVITAI_BASE_URL = 'https://civitai.com';

/** True when `expiresAt` is at/under `now + 30s` (refresh ahead of expiry). */
export function needsRefresh(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt <= now + SKEW_MS;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for prompt-lab auth`);
  return v;
}

type SessionShape = { tokens: OAuthTokens };

/**
 * Minimal runtime guard for the token fields we depend on: a usable token
 * needs a non-empty `access_token` and a finite numeric `expires_at` (so
 * `needsRefresh` never computes against NaN). `refresh_token` is checked
 * separately, only on the path that actually refreshes.
 */
function isUsableTokens(value: unknown): value is OAuthTokens {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.access_token === 'string' &&
    t.access_token.length > 0 &&
    typeof t.expires_at === 'number' &&
    Number.isFinite(t.expires_at)
  );
}

function parseSealedSession(sealed: string, secret: string): OAuthTokens {
  const raw = unsealCookie(sealed, secret);
  if (!raw) {
    throw new Error(
      'PROMPT_LAB_SESSION failed to unseal — wrong SESSION_SECRET or not an app cookie. ' +
        'Re-copy civ_session from devtools.',
    );
  }
  const parsed = JSON.parse(raw) as SessionShape;
  if (!isUsableTokens(parsed?.tokens)) {
    throw new Error('PROMPT_LAB_SESSION had no usable tokens — re-copy civ_session from devtools.');
  }
  return parsed.tokens;
}

async function readCachedTokens(): Promise<OAuthTokens | null> {
  let raw: string;
  try {
    raw = await readFile(CACHE_PATH, 'utf8');
  } catch (err) {
    // A missing cache is the normal first-run case. Anything else (corrupt
    // permissions, I/O error) is real — surface it rather than silently
    // falling back and re-refreshing on every invocation.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isUsableTokens(parsed)) {
    throw new Error(`Cached tokens at ${CACHE_PATH} are corrupt — delete the file and re-run.`);
  }
  return parsed;
}

async function writeCachedTokens(tokens: OAuthTokens): Promise<void> {
  try {
    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(tokens, null, 2));
  } catch (err) {
    throw new Error(
      `Failed to cache tokens to ${CACHE_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function refresh(tokens: OAuthTokens): Promise<OAuthTokens> {
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token in session — re-paste PROMPT_LAB_SESSION from devtools.');
  }
  return oauthRefresh({
    baseUrl: process.env.CIVITAI_BASE_URL ?? DEFAULT_CIVITAI_BASE_URL,
    clientId: requireEnv('CIVITAI_CLIENT_ID'),
    clientSecret: requireEnv('CIVITAI_CLIENT_SECRET'),
    refreshToken: tokens.refresh_token,
  });
}

/**
 * Resolve a usable access token for the orchestrator. Priority:
 *   1. PROMPT_LAB_ACCESS_TOKEN (raw, used as-is, no refresh).
 *   2. Cached `.auth/prompt-lab.json` if still valid.
 *   3. PROMPT_LAB_SESSION (sealed civ_session): unseal → refresh if near expiry → cache.
 */
export async function resolveAccessToken(): Promise<string> {
  const raw = process.env.PROMPT_LAB_ACCESS_TOKEN;
  if (raw) return raw;

  const cached = await readCachedTokens();
  if (cached && !needsRefresh(cached.expires_at)) return cached.access_token;

  const sealed = process.env.PROMPT_LAB_SESSION;
  if (!sealed) {
    throw new Error(
      'Set PROMPT_LAB_SESSION (sealed civ_session cookie) or PROMPT_LAB_ACCESS_TOKEN in .env. ' +
        'Log into the app via `pnpm dev`, then copy civ_session from devtools.',
    );
  }
  const secret = requireEnv('SESSION_SECRET');
  const sessionTokens = parseSealedSession(sealed, secret);

  if (!needsRefresh(sessionTokens.expires_at)) return sessionTokens.access_token;

  const fresh = await refresh(sessionTokens);
  await writeCachedTokens(fresh);
  return fresh.access_token;
}
