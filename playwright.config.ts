import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE_PATH } from './e2e/global-setup';

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

if (!process.env.NEXT_PUBLIC_CIVITAI_BASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_CIVITAI_BASE_URL is required for e2e (your local Civitai dev host). See playwright.config.ts header.',
  );
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // Sequential — the OAuth consent record is shared user state.
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
    },
  },
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: STORAGE_STATE_PATH,
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
