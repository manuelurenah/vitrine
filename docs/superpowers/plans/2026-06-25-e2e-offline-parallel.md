# E2E Offline-by-Default + Parallel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm test:e2e` run offline by default (no Civitai dev server, no real account), with a persistent-but-clean test DB and parallel workers; keep a real-OAuth mode behind an env flag.

**Architecture:** 20 of 21 specs already run on a sealed `civ_session` cookie + MSW. Gate the Civitai `testing-login` handshake behind `E2E_REAL_OAUTH=1`, move the per-spec cookie into a worker-scoped Playwright fixture that mints one synthetic user per worker slot, truncate the test DB at `globalSetup`, and turn on file-level parallel workers.

**Tech Stack:** Playwright `@playwright/test ^1.57.0`, Postgres via `pg`, `@civitai/app-sdk` `sealCookie`, MSW (node), Next 16 test server.

## Global Constraints

- Real Postgres is required; never mock the DB layer (verbatim: "app fails loud if `DATABASE_URL` unset").
- All 21 specs keep their existing assertions.
- Offline is the default; real OAuth is opt-in via `E2E_REAL_OAUTH=1`.
- Per-worker synthetic user id formula (use this exact expression everywhere): `process.env.TEST_USER_ID ?? String(90000 + parallelIndex)`.
- File-level parallelism only: `fullyParallel: false`, `workers: N`.
- `00-auth-flow` is skipped unless `E2E_REAL_OAUTH=1`; real-mode runs pin `TEST_USER_ID=1`.
- Test DB is never dropped; truncate-all happens at `globalSetup`; no data teardown.
- `SESSION_SECRET` is required to seal the cookie.
- Drizzle migration metadata lives in the `drizzle` schema, so a `public`-schema-only `TRUNCATE` leaves migrations intact.

## Pre-flight (one-time, assumed already done)

```bash
pnpm dev:up            # Postgres (+ MinIO + Redis) via docker
pnpm test:db:setup     # CREATE DATABASE vitrine_test + apply migrations
pnpm test:e2e:install  # Chromium for Playwright
```

The repo `.env` already provides `SESSION_SECRET`, `TEST_DATABASE_URL`, and `NEXT_PUBLIC_CIVITAI_BASE_URL`. All `pnpm test:*` scripts run with `--env-file=.env`.

---

## Task 1: Offline-by-default (Civitai dev server becomes opt-in)

Decouple the suite from the Civitai dev server. The handshake runs only in real mode; offline seals the `civ_session` cookie locally. `00-auth-flow` is skipped offline. Workers stay at 1 for now.

**Files:**
- Create: `e2e/helpers/session.ts`
- Modify: `e2e/global-setup.ts` (full rewrite of the file)
- Modify: `e2e/00-auth-flow.spec.ts:5` (describe block — add skip guard)
- Modify: `playwright.config.ts:28-32` (soften env requirement)

**Interfaces:**
- Produces: `sealCivSession(userId: string): string` from `e2e/helpers/session.ts` — returns a sealed `civ_session` cookie value. Consumed by `global-setup.ts` now and by `e2e/fixtures.ts` in Task 3.
- Produces: `STORAGE_STATE_PATH: string` (unchanged export) from `e2e/global-setup.ts`.

- [ ] **Step 1: Establish the failing observation**

With the Civitai dev server NOT running and a bogus base URL, the suite currently aborts in `globalSetup`. Confirm the current (pre-change) failure:

Run: `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e -g "@api health|api/health" --reporter=line`
Expected: FAIL — `globalSetup` throws on the `GET /api/auth/csrf` fetch to `http://civitai.invalid` (the suite never reaches any spec).

- [ ] **Step 2: Create the shared session-sealing helper**

Create `e2e/helpers/session.ts`:

```ts
import { sealCookie } from '@civitai/app-sdk';

/**
 * Seal a fake-token `civ_session` cookie VALUE for the given app user id,
 * using SESSION_SECRET. Shared by global-setup (real-OAuth mode) and the
 * per-worker storageState fixture (Task 3). MSW intercepts /api/v1/me + buzz
 * on the test server, so this mock token is never validated against Civitai.
 */
export function sealCivSession(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required to seal an e2e app session cookie.');
  }
  const session = {
    tokens: {
      access_token: 'e2e-mock-access-token',
      refresh_token: 'e2e-mock-refresh-token',
      token_type: 'Bearer',
      expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
      scope: 0xff,
    },
    user: { id: Number(userId), username: `e2e-tester-${userId}` },
  };
  return sealCookie(JSON.stringify(session), secret);
}
```

- [ ] **Step 3: Rewrite `e2e/global-setup.ts`**

Replace the ENTIRE contents of `e2e/global-setup.ts` with:

```ts
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
```

- [ ] **Step 4: Skip the auth spec offline**

In `e2e/00-auth-flow.spec.ts`, add a skip guard as the first line inside the `describe` callback (currently line 6 is `test.beforeAll`):

```ts
test.describe('OAuth + session', () => {
  test.skip(
    process.env.E2E_REAL_OAUTH !== '1',
    'Real OAuth round-trip — needs the Civitai dev server. Run with E2E_REAL_OAUTH=1.',
  );

  test.beforeAll(async () => {
```

- [ ] **Step 5: Soften the Civitai env requirement in the config**

In `playwright.config.ts`, replace the hard throw at lines 28-32:

```ts
if (!process.env.NEXT_PUBLIC_CIVITAI_BASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_CIVITAI_BASE_URL is required for e2e (your local Civitai dev host). See playwright.config.ts header.',
  );
}
```

with:

```ts
const REAL_OAUTH = process.env.E2E_REAL_OAUTH === '1';
// The app's Zod env still needs a syntactically-valid URL even offline; a
// dummy is fine because MSW intercepts all Civitai calls. Only real-OAUTH
// mode needs a reachable host.
const CIVITAI_BASE_URL = process.env.NEXT_PUBLIC_CIVITAI_BASE_URL ?? 'http://civitai.invalid';
if (REAL_OAUTH && !process.env.NEXT_PUBLIC_CIVITAI_BASE_URL) {
  throw new Error(
    'E2E_REAL_OAUTH=1 requires NEXT_PUBLIC_CIVITAI_BASE_URL (your local Civitai dev host).',
  );
}
```

Then ensure the test server receives the base URL. In the `webServer.env` block (lines 49-54), add the line:

```ts
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      MOCK_CIVITAI: '1',
      TEST_PORT: new URL(APP_URL).port || '3334',
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_PUBLIC_CIVITAI_BASE_URL: CIVITAI_BASE_URL,
    },
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Verify offline run passes**

Stop the Civitai dev server (or just leave it down). Run a fast subset offline:

Run: `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e -g "create product" --reporter=line`
Expected: PASS — `globalSetup` no longer contacts Civitai; the catalog spec runs green; no network to `civitai.invalid`.

Then confirm the auth spec is skipped:

Run: `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e e2e/00-auth-flow.spec.ts --reporter=line`
Expected: 1 skipped, 0 failed.

- [ ] **Step 8: Commit**

```bash
git add e2e/helpers/session.ts e2e/global-setup.ts e2e/00-auth-flow.spec.ts playwright.config.ts
git commit -m "test(e2e): make Civitai dev server opt-in (E2E_REAL_OAUTH)

Offline default seals civ_session locally and skips the real-OAuth spec;
the testing-login handshake runs only when E2E_REAL_OAUTH=1.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Truncate-all at globalSetup + global teardown

Guarantee a clean DB at the start of every run (robust to crashed runs), keep the DB persistent, and close pools cleanly at the end.

**Files:**
- Modify: `e2e/global-setup.ts` (add `pg` import, `truncateAllTables()`, call it first)
- Create: `e2e/global-teardown.ts`
- Modify: `playwright.config.ts:36` (add `globalTeardown`)

**Interfaces:**
- Consumes: `closeDb()` from `e2e/helpers/db.ts` (existing export, currently unused).

- [ ] **Step 1: Add the truncate helper to `global-setup.ts`**

At the top of `e2e/global-setup.ts`, add to the imports:

```ts
import { Pool } from 'pg';
```

Add this function above `export default async function globalSetup`:

```ts
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
```

Call it as the first line of `globalSetup`:

```ts
export default async function globalSetup(_config: FullConfig): Promise<void> {
  await truncateAllTables();

  const userId = process.env.TEST_USER_ID ?? '1';
```

- [ ] **Step 2: Create `e2e/global-teardown.ts`**

```ts
import { closeDb } from './helpers/db';

/**
 * Close the shared pg pool opened by helpers/db.ts in the main process. The
 * test DB is intentionally NOT dropped or wiped here — a clean slate is
 * guaranteed at globalSetup instead (survives crashed runs, preserves rows
 * for post-mortem debugging).
 */
export default async function globalTeardown(): Promise<void> {
  await closeDb();
}
```

- [ ] **Step 3: Wire teardown in the config**

In `playwright.config.ts`, just after `globalSetup: './e2e/global-setup.ts',` (line 36) add:

```ts
  globalTeardown: './e2e/global-teardown.ts',
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Verify clean-at-start**

Seed a stray row into the test DB, then prove the next run wipes it. Use the catalog spec (asserts `countRows('products')` after creating exactly one product — a leftover row would make it fail):

```bash
# leave a stray product behind
node --env-file=.env -e "import('pg').then(async ({default:{Pool}})=>{const p=new Pool({connectionString:process.env.TEST_DATABASE_URL});await p.query(\"INSERT INTO users (id,civitai_id,last_seen_at) VALUES ('1',1,now()) ON CONFLICT DO NOTHING\");await p.query(\"INSERT INTO products (user_id,name,status) VALUES ('1','STRAY','live')\");await p.end();console.log('stray inserted')})"
```

Run: `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e -g "create product" --reporter=line`
Expected: PASS — `globalSetup` truncates the stray row first, so the spec's row count is exact. Console shows `[e2e] truncated N public tables`.

- [ ] **Step 6: Commit**

```bash
git add e2e/global-setup.ts e2e/global-teardown.ts playwright.config.ts
git commit -m "test(e2e): truncate test DB at globalSetup, close pools at teardown

Clean slate guaranteed on entry (survives crashed runs, preserves rows
for post-mortem); DB is never dropped.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Parallel workers + per-worker user isolation

Mint one synthetic app user per Playwright worker slot, deliver its `civ_session` via a worker-scoped storageState fixture, move the offline cookie out of `globalSetup`, and enable file-level parallel workers.

**Files:**
- Modify: `e2e/helpers/db.ts:14` (per-worker user formula)
- Modify: `e2e/fixtures.ts` (full rewrite — worker-scoped storageState)
- Modify: `e2e/global-setup.ts` (offline writes nothing; real mode writes `.auth/civitai-cookies.json`; export `CIVITAI_COOKIES_PATH`; drop `STORAGE_STATE_PATH` + `civSessionCookie`)
- Modify: `playwright.config.ts` (remove `STORAGE_STATE_PATH` import + `use.storageState`; add `workers`)
- Modify: `.gitignore` (ensure `.auth/` is ignored)

**Interfaces:**
- Consumes: `sealCivSession(userId)` from `e2e/helpers/session.ts` (Task 1).
- Produces: `CIVITAI_COOKIES_PATH: string` from `e2e/global-setup.ts` — path to the real-mode Civitai cookie file, read by `e2e/fixtures.ts`.
- Per-worker user id is `process.env.TEST_USER_ID ?? String(90000 + workerInfo.parallelIndex)`, consumed identically by `helpers/db.ts` (via `TEST_PARALLEL_INDEX`) and `fixtures.ts` (via `workerInfo.parallelIndex`).

- [ ] **Step 1: Per-worker user id in `helpers/db.ts`**

In `e2e/helpers/db.ts`, replace line 14:

```ts
const TEST_USER_ID = process.env.TEST_USER_ID ?? '1';
```

with:

```ts
// One synthetic app user per Playwright worker slot. TEST_PARALLEL_INDEX is
// set by Playwright in each worker process (0..workers-1, stable for the
// worker's life, reused as a slot picks up later files). The 90000+ base
// avoids collisions with real Civitai ids. TEST_USER_ID overrides it
// (real-OAuth mode pins this to '1').
const PARALLEL_INDEX = Number.parseInt(process.env.TEST_PARALLEL_INDEX ?? '0', 10);
const TEST_USER_ID = process.env.TEST_USER_ID ?? String(90000 + PARALLEL_INDEX);
```

- [ ] **Step 2: Worker-scoped storageState fixture in `e2e/fixtures.ts`**

Replace the ENTIRE contents of `e2e/fixtures.ts` with:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import { CIVITAI_COOKIES_PATH } from './global-setup';
import { sealCivSession } from './helpers/session';

/**
 * Per-worker auth. Each worker slot seals its own `civ_session` cookie for a
 * synthetic user id (90000 + parallelIndex), so files running in parallel on
 * different workers never clobber each other's rows. Uses Playwright's
 * documented worker-scoped storageState pattern (a per-worker JSON file).
 *
 * In real-OAuth mode, the Civitai NextAuth cookies captured by global-setup
 * (.auth/civitai-cookies.json) are merged in so the auth spec lands on the
 * consent screen rather than a login screen.
 */

type PwCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
};

function workerUserId(parallelIndex: number): string {
  return process.env.TEST_USER_ID ?? String(90000 + parallelIndex);
}

export const test = base.extend<object, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({}, use, workerInfo) => {
      const userId = workerUserId(workerInfo.parallelIndex);
      const cookies: PwCookie[] = [
        {
          name: 'civ_session',
          value: sealCivSession(userId),
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ];
      if (existsSync(CIVITAI_COOKIES_PATH)) {
        const extra = JSON.parse(readFileSync(CIVITAI_COOKIES_PATH, 'utf8')) as PwCookie[];
        cookies.push(...extra);
      }
      const file = `.auth/worker-${workerInfo.parallelIndex}.json`;
      await mkdir('.auth', { recursive: true });
      await writeFile(file, JSON.stringify({ cookies, origins: [] }), 'utf8');
      await use(file);
    },
    { scope: 'worker' },
  ],
});

export { expect };
```

- [ ] **Step 3: Move the cookie out of `global-setup.ts`**

In `e2e/global-setup.ts`:

1. Delete the `export const STORAGE_STATE_PATH = '.auth/civitai-session.json';` line and add instead:

```ts
export const CIVITAI_COOKIES_PATH = '.auth/civitai-cookies.json';
```

2. Delete the `civSessionCookie()` function (no longer used — the fixture seals per-worker).
3. Delete the now-unused `sealCivSession` import line.
4. Replace the `export default async function globalSetup` body with:

```ts
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
```

(`PwCookie`, `parseSetCookie`, `toPwCookie`, `captureCivitaiCookies`, `truncateAllTables`, `requireEnv` all stay.)

- [ ] **Step 4: Update `playwright.config.ts` (storageState + workers)**

1. Delete the import at line 2:

```ts
import { STORAGE_STATE_PATH } from './e2e/global-setup';
```

2. Delete the `storageState: STORAGE_STATE_PATH,` line from the `use` block (line 61). The fixture now owns it.
3. Set the worker count. Replace `workers: 1, // Sequential — the OAuth consent record is shared user state.` (line 40) with:

```ts
  // File-level parallelism: whole spec files run concurrently on separate
  // workers, each pinned to its own synthetic user (e2e/fixtures.ts). Tests
  // within a file stay serial (fullyParallel: false). Real-OAuth runs should
  // pass --workers=1 (shared Civitai consent state).
  workers: process.env.E2E_REAL_OAUTH === '1' ? 1 : process.env.CI ? 4 : undefined,
```

- [ ] **Step 5: Ensure `.auth/` is gitignored**

Run: `grep -qxF '.auth/' .gitignore || grep -qF '.auth' .gitignore && echo "already ignored" || (printf '\n# Playwright e2e auth state\n.auth/\n' >> .gitignore && echo "added .auth/ to .gitignore")`
Expected: prints either `already ignored` or `added .auth/ to .gitignore`.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Verify parallel offline run**

Run the full suite offline with parallelism on:

Run: `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e --reporter=line`
Expected: all specs PASS except `00-auth-flow` (skipped). Playwright reports multiple workers running concurrently. Wall-clock is lower than the previous serial run.

- [ ] **Step 8: Commit**

```bash
git add e2e/helpers/db.ts e2e/fixtures.ts e2e/global-setup.ts playwright.config.ts .gitignore
git commit -m "test(e2e): parallel workers with per-worker user isolation

One synthetic user per worker slot via a worker-scoped storageState
fixture; offline cookie minted in the fixture, not globalSetup. Enables
file-level parallel workers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Documentation

Document the offline default, the real-OAuth opt-in, and parallelism.

**Files:**
- Modify: `.env.example` (e2e block, lines 64-72)
- Modify: `README.md` (End-to-end tests section, lines 141-180)

- [ ] **Step 1: Update `.env.example`**

In the `# --- e2e (playwright) ---` block, after the `# MOCK_CIVITAI=1` line (line 72), append:

```bash
# By default `pnpm test:e2e` runs FULLY OFFLINE — no Civitai dev server, no
# real account, parallel workers, each with its own synthetic test user. The
# 00-auth-flow spec (real OAuth round-trip) is skipped. To run it, start your
# local Civitai dev server and set both:
# E2E_REAL_OAUTH=1
# TEST_USER_ID=1
```

- [ ] **Step 2: Rewrite the README "End-to-end tests" intro + Running + Auth strategy**

Replace lines 143 and the `### Running` (154-162) and `### Auth strategy` (164-166) sections with:

```markdown
Playwright suite under `e2e/`. Runs **fully offline by default** against an isolated `vitrine_test` Postgres database and a dedicated Next dev server (port 3334) with MSW intercepting all Civitai + orchestrator HTTP calls — no Buzz is spent, no real orchestrator, and **no Civitai dev server required**. Specs run in parallel, each worker pinned to its own synthetic test user.
```

```markdown
### Running

```bash
pnpm test:e2e
```

Fully offline — no Civitai dev server needed. Playwright auto-boots the test Next dev server (`scripts/test-server.mjs`); `pnpm dev` can run alongside it (the test server uses `.next-test/` as its `distDir`). Files run in parallel across workers; tune with `--workers=N`.

To exercise the **real OAuth round-trip** (`00-auth-flow`), start your local Civitai dev server and run:

```bash
E2E_REAL_OAUTH=1 \
TEST_USER_ID=1 \
NEXT_PUBLIC_CIVITAI_BASE_URL=http://localhost:3000 \
pnpm test:e2e e2e/00-auth-flow.spec.ts
```

### Auth strategy

Offline (default): each Playwright worker seals a fake-token `civ_session` cookie for its own synthetic user (`90000 + workerIndex`) using `SESSION_SECRET`, so every spec starts pre-authenticated and workers never clobber each other's data. MSW answers `/api/v1/me` + buzz, so the mock token is never validated.

Real-OAuth (`E2E_REAL_OAUTH=1`): `globalSetup` signs in once via Civitai's `testing-login` provider and caches its cookies; the `00-auth-flow` spec (skipped otherwise) clears `civ_session` and drives the real authorize → consent → callback flow. Run it with `--workers=1` / `TEST_USER_ID=1` (shared Civitai consent state).

The test DB is **persistent**: `globalSetup` truncates all tables on entry (a clean slate that survives crashed runs and leaves rows intact for post-mortem debugging), and it is never dropped.
```

Also update the redirect-URI note (line 152) to clarify it is only needed for real-OAuth mode:

```markdown
For real-OAuth mode only: make sure your Civitai OAuth app has both `http://localhost:3333/api/auth/callback/civitai` and `http://localhost:3334/api/auth/callback/civitai` registered as redirect URIs.
```

And update the `00-auth-flow` row in the "What's covered" table (line 172) to:

```markdown
| `00-auth-flow` | real OAuth → onboarding redirect for a fresh user (skipped unless `E2E_REAL_OAUTH=1`) |
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs(e2e): document offline-default, real-OAuth opt-in, parallelism

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `pnpm typecheck` → PASS.
- [ ] Offline full run (Civitai dev server down): `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid pnpm test:e2e` → all green, `00-auth-flow` skipped, multiple workers, no network to Civitai.
- [ ] Real-OAuth (Civitai dev server up): `E2E_REAL_OAUTH=1 TEST_USER_ID=1 NEXT_PUBLIC_CIVITAI_BASE_URL=http://localhost:3000 pnpm test:e2e e2e/00-auth-flow.spec.ts` → PASS.
- [ ] Persistence: after a deliberately failed run, rows remain in `vitrine_test`; the next run starts clean.

## Self-Review notes

- **Spec coverage:** Part A → Task 1; Part B → Task 2; Part C → Task 3; docs → Task 4. All spec sections mapped.
- **Type consistency:** `sealCivSession(userId: string): string` defined in Task 1, consumed unchanged in Tasks 1 & 3. `CIVITAI_COOKIES_PATH` defined in Task 3 (`global-setup.ts`), consumed in `fixtures.ts`. User formula `90000 + parallelIndex` identical in `helpers/db.ts` (via `TEST_PARALLEL_INDEX`) and `fixtures.ts` (via `workerInfo.parallelIndex`).
- **Known follow-ups:** `STORAGE_STATE_PATH` is created in Task 1 and removed in Task 3 — intentional, keeps each task independently shippable/testable.
