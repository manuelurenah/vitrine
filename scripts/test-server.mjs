#!/usr/bin/env node
/**
 * Test-mode dev server. Boots `next dev` on a separate port pointed at the
 * test database and with MSW interception enabled. Used by Playwright's
 * `webServer` config — also runnable standalone for poking around in test
 * mode.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:5432/vitrine_test';
const PORT = process.env.TEST_PORT ?? '3334';

// Preload MSW *before* Next boots. Next's server/lib/patch-fetch.js captures
// `globalThis.fetch` at bootstrap and routes every server-side fetch through
// that captured copy. If MSW patches fetch later (via instrumentation.ts),
// route-handler SDK calls bypass the mock and hit live Civitai/orchestrator.
// Requiring the preload via NODE_OPTIONS guarantees MSW patches fetch first,
// in the dev server and every Next worker it spawns.
const mswPreload = fileURLToPath(new URL('./msw-preload.cjs', import.meta.url));
const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --require ${mswPreload}`.trim();

const child = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'dev', '-p', PORT], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
    MOCK_CIVITAI: '1',
    NODE_OPTIONS: nodeOptions,
    NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    // Isolate Next's dev artifacts + lockfile so this test server can run
    // alongside `pnpm dev` (which holds .next/dev/lock).
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? '.next-test',
  },
});

const forward = (signal) => () => child.kill(signal);
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));

child.on('exit', (code) => process.exit(code ?? 0));
