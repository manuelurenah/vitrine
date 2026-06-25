import { defineConfig, devices } from '@playwright/test';

/**
 * The e2e suite signs into a local Civitai dev server (real OAuth) and
 * exercises the starter against an isolated test database with MSW
 * intercepting Civitai + orchestrator API calls — so cook flows are
 * deterministic and no Buzz is spent.
 *
 * Prereqs:
 *   - NEXT_PUBLIC_CIVITAI_BASE_URL  — your local Civitai dev host (for OAuth + testing-login)
 *   - APP_URL           — where the test starter is reachable (defaults to http://localhost:3334)
 *   - TEST_DATABASE_URL — Postgres URL for the isolated test database
 *                         (defaults to postgres://app:app@localhost:5432/vitrine_test)
 *   - OAuth app registered on that Civitai instance with
 *     APP_URL/api/auth/callback/civitai as a redirect URI.
 *   - `pnpm test:db:setup` once per checkout (creates DB + runs migrations).
 *   - Civitai dev server running (`pnpm dev` in the `civitai/civitai` repo).
 *
 * Playwright will boot the test Next dev server itself (port 3334, MSW on,
 * test DB) — no manual `pnpm dev` required.
 */

const APP_URL = process.env.APP_URL ?? 'http://localhost:3334';
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:5432/vitrine_test';

const REAL_OAUTH = process.env.E2E_REAL_OAUTH === '1';
// The app's Zod env still needs a syntactically-valid URL even offline; a
// dummy is fine because MSW intercepts all Civitai calls. Only real-OAuth
// mode needs a reachable host.
const CIVITAI_BASE_URL = process.env.NEXT_PUBLIC_CIVITAI_BASE_URL ?? 'http://civitai.invalid';
if (REAL_OAUTH && !process.env.NEXT_PUBLIC_CIVITAI_BASE_URL) {
  throw new Error(
    'E2E_REAL_OAUTH=1 requires NEXT_PUBLIC_CIVITAI_BASE_URL (your local Civitai dev host).',
  );
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // File-level parallelism: whole spec files run concurrently on separate
  // workers, each pinned to its own synthetic user (e2e/fixtures.ts). Tests
  // within a file stay serial (fullyParallel: false). Capped at 4 because the
  // bottleneck is the single Next dev test server (lazy route compilation),
  // not CPU cores — more workers just saturate it and time out cold compiles.
  // Real-OAuth runs use 1 worker (shared Civitai consent state).
  workers: process.env.E2E_REAL_OAUTH === '1' ? 1 : 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'pnpm test:server',
    url: APP_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      MOCK_CIVITAI: '1',
      TEST_PORT: new URL(APP_URL).port || '3334',
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_PUBLIC_CIVITAI_BASE_URL: CIVITAI_BASE_URL,
    },
  },
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // storageState is provided per-worker by e2e/fixtures.ts (per-worker user).
    // Accept self-signed certs on local Civitai dev hosts (e.g. civitai-dev.blue).
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
