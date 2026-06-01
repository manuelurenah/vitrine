import { expect, test } from './fixtures';
import { resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('OAuth + session', () => {
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
    await expect(page.getByRole('heading', { name: /shot on demand\./i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with Civitai/i })).toBeVisible();

    await signInToApp(page, baseURL!, { realOAuth: true });

    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible();
  });
});
