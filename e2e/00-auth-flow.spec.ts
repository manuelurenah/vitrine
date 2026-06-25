import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { resetUserData } from './helpers/db';

test.describe('OAuth + session', () => {
  test.skip(
    process.env.E2E_REAL_OAUTH !== '1',
    'Real OAuth round-trip — needs the Civitai dev server. Run with E2E_REAL_OAUTH=1.',
  );

  test.beforeAll(async () => {
    // Fresh user state — no users row, no onboarding row. Forces the post-
    // login redirect into onboarding.
    await resetUserData();
  });

  test.beforeEach(async ({ context }) => {
    // Drop the pre-sealed app-session cookie that global-setup injected so
    // we actually exercise the real OAuth round-trip in this spec.
    await context.clearCookies({ name: 'civ_session' });
  });

  test('signs in via Civitai OAuth and lands on /onboarding/welcome for a new user', async ({
    page,
    baseURL,
  }) => {
    await page.goto(baseURL!);
    await expect(page.getByRole('heading', { name: /shot on demand/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with Civitai/i })).toBeVisible();

    await signInToApp(page, baseURL!, { realOAuth: true });

    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible();
  });
});
