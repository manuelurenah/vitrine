import { expect, test } from './fixtures';
import { markOnboardingComplete, resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Photoshoot list + new', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot`);
    await expect(page.getByRole('heading', { name: /photoshoot\./i })).toBeVisible();
  });

  test('new builder page renders', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/new`);
    await expect(page.getByRole('heading', { name: /photoshoot\./i })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('submits a brief, MSW mocks orchestrator, redirects to /photoshoot/[id]', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/new`);

    // Defaults: templates from defaultOn are pre-selected; variants=1; ratio=4:5.
    const submit = page.getByRole('button', { name: /^generate/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await page.waitForURL(/\/photoshoot\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
