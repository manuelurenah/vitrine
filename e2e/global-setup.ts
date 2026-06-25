import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { Pool } from 'pg';

/**
 * Playwright globalSetup.
 *
 * Always: truncate the test DB for a clean slate (see truncateAllTables).
 *
 * Offline default (E2E_REAL_OAUTH unset): contacts nothing else. Each worker
 * mints its own `civ_session` cookie in the storageState fixture
 * (e2e/fixtures.ts). MSW intercepts /api/v1/me + buzz on the test server, so
 * the mock token is never validated.
 *
 * Real-OAuth mode (E2E_REAL_OAUTH=1): sign in to the local Civitai dev server
 * via the `testing-login` provider and write its NextAuth cookies to
 * CIVITAI_COOKIES_PATH, so the `00-auth-flow` spec lands on the consent screen
 * during the real OAuth round-trip.
 */

export const CIVITAI_COOKIES_PATH = '.auth/civitai-cookies.json';

const E2E_REAL_OAUTH = process.env.E2E_REAL_OAUTH === '1';

interface PwCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

interface ParsedCookie {
  name: string;
  value: string;
  attrs: Map<string, string | true>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is required for E2E_REAL_OAUTH mode. See playwright.config.ts header.`);
  }
  return v;
}

function parseSetCookie(line: string): ParsedCookie {
  const parts = line.split(';');
  const head = parts[0] ?? '';
  const eq = head.indexOf('=');
  const name = head.slice(0, eq).trim();
  const value = head.slice(eq + 1).trim();
  const attrs = new Map<string, string | true>();
  for (const p of parts.slice(1)) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const pe = trimmed.indexOf('=');
    if (pe === -1) attrs.set(trimmed.toLowerCase(), true);
    else attrs.set(trimmed.slice(0, pe).toLowerCase(), trimmed.slice(pe + 1));
  }
  return { name, value, attrs };
}

function toPwCookie(parsed: ParsedCookie, defaultDomain: string): PwCookie {
  const sameSiteRaw = String(parsed.attrs.get('samesite') ?? 'Lax');
  const sameSite =
    sameSiteRaw.toLowerCase() === 'strict'
      ? 'Strict'
      : sameSiteRaw.toLowerCase() === 'none'
        ? 'None'
        : 'Lax';
  const domain = String(parsed.attrs.get('domain') ?? defaultDomain).replace(/^\./, '');
  return {
    name: parsed.name,
    value: parsed.value,
    domain,
    path: String(parsed.attrs.get('path') ?? '/'),
    expires: -1,
    httpOnly: !!parsed.attrs.get('httponly'),
    secure: !!parsed.attrs.get('secure'),
    sameSite,
  };
}

/**
 * Sign into the local Civitai dev server via `testing-login` and return its
 * NextAuth cookies as Playwright cookies. Only used in real-OAuth mode.
 */
async function captureCivitaiCookies(userId: string): Promise<PwCookie[]> {
  // Local Civitai dev often uses a self-signed cert on a custom hostname.
  // Disable TLS verification for this setup process only (not the browsers).
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const civitaiBaseUrl = requireEnv('NEXT_PUBLIC_CIVITAI_BASE_URL');
  const civitaiHost = new URL(civitaiBaseUrl).hostname;

  const jar = new Map<string, string>();
  const parsed = new Map<string, ParsedCookie>();
  const cookieHeader = () =>
    Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

  async function req(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {});
    if (jar.size) headers.set('cookie', cookieHeader());
    const res = await fetch(`${civitaiBaseUrl}${path}`, { ...init, headers, redirect: 'manual' });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const p = parseSetCookie(line);
      if (!p.name) continue;
      if (p.value === '' || /^deleted$/i.test(p.value)) {
        jar.delete(p.name);
        parsed.delete(p.name);
      } else {
        jar.set(p.name, p.value);
        parsed.set(p.name, p);
      }
    }
    return res;
  }

  const csrfRes = await req('/api/auth/csrf');
  if (!csrfRes.ok) throw new Error(`GET /api/auth/csrf failed (${csrfRes.status})`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const form = new URLSearchParams({
    csrfToken,
    id: userId,
    callbackUrl: `${civitaiBaseUrl}/`,
    json: 'true',
  });
  const loginRes = await req('/api/auth/callback/testing-login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (loginRes.status >= 400) {
    throw new Error(
      `testing-login POST failed (${loginRes.status}): ${(await loginRes.text()).slice(0, 500)}`,
    );
  }

  const sessionRes = await req('/api/auth/session');
  const session = (await sessionRes.json()) as { user?: { id?: number } };
  if (Number(session?.user?.id) !== Number(userId)) {
    throw new Error(
      `testing-login succeeded but /api/auth/session has no matching user.\n` +
        `  Got: ${JSON.stringify(session)}\n  Expected user id: ${userId}\n` +
        `Is the testing-login provider enabled (NODE_ENV=development on Civitai)?`,
    );
  }

  return Array.from(parsed.values()).map((p) => toPwCookie(p, civitaiHost));
}

/**
 * Wipe every row in the test DB before the run. Clean slate is guaranteed at
 * setup (not teardown) so it survives a crashed/aborted previous run and
 * leaves rows intact for post-mortem debugging after a failure. The DB itself
 * is never dropped. Drizzle's migration metadata lives in the `drizzle`
 * schema, so truncating only `public` tables leaves migrations intact.
 */
async function truncateAllTables(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for e2e globalSetup.');
  }
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    if (rows.length === 0) return;
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    console.log(`[e2e] truncated ${rows.length} public tables in the test DB`);
  } finally {
    await pool.end();
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await truncateAllTables();

  if (!E2E_REAL_OAUTH) {
    console.log('[e2e] offline mode — per-worker civ_session provided by the fixture');
    return;
  }

  const userId = process.env.TEST_USER_ID ?? '1';
  const civitaiCookies = await captureCivitaiCookies(userId);
  await mkdir(dirname(CIVITAI_COOKIES_PATH), { recursive: true });
  await writeFile(CIVITAI_COOKIES_PATH, JSON.stringify(civitaiCookies, null, 2), 'utf8');
  console.log(
    `[e2e] real-OAuth — wrote ${civitaiCookies.length} Civitai cookies → ${CIVITAI_COOKIES_PATH}`,
  );
}
