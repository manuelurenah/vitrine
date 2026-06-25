import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { sealCivSession } from './helpers/session';

/**
 * Playwright globalSetup.
 *
 * Offline default (E2E_REAL_OAUTH unset): seal a fake `civ_session` cookie for
 * the test user and write it to the Playwright storageState file. No Civitai
 * dev server is contacted. MSW intercepts /api/v1/me + buzz on the test
 * server, so the mock token is never validated.
 *
 * Real-OAuth mode (E2E_REAL_OAUTH=1): additionally sign in to the local
 * Civitai dev server via the `testing-login` provider and prepend its NextAuth
 * cookies, so the `00-auth-flow` spec lands on the consent screen during the
 * real OAuth round-trip.
 */

export const STORAGE_STATE_PATH = '.auth/civitai-session.json';

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

function civSessionCookie(userId: string): PwCookie {
  return {
    name: 'civ_session',
    value: sealCivSession(userId),
    domain: 'localhost',
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
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

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const userId = process.env.TEST_USER_ID ?? '1';
  const cookies: PwCookie[] = [];

  if (E2E_REAL_OAUTH) {
    cookies.push(...(await captureCivitaiCookies(userId)));
  }
  cookies.push(civSessionCookie(userId));

  const state = { cookies, origins: [] };
  await mkdir(dirname(STORAGE_STATE_PATH), { recursive: true });
  await writeFile(STORAGE_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');

  console.log(
    `[e2e] storageState written (${cookies.length} cookies, realOAuth=${E2E_REAL_OAUTH}) → ${STORAGE_STATE_PATH}`,
  );
}
