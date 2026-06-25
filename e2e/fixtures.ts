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
