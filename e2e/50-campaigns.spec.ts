import { expect, test } from './fixtures';
import { markOnboardingComplete, resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Campaigns list + new brief', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);
    await expect(page.getByRole('heading', { name: /campaigns\./i })).toBeVisible();
  });

  test('new brief page renders form fields', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);
    await expect(page.getByLabel(/campaign title/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start cooking/i })).toBeVisible();
  });

  test('submits a brief, MSW mocks orchestrator, redirects to /campaigns/[id]', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // BriefForm ships filled defaults (title, description, presetIds: ig-feed,
    // ig-story, li). Just submit.
    const submit = page.getByRole('button', { name: /start cooking/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    // CampaignDetail renders the brief title in an h1/h2 heading.
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
