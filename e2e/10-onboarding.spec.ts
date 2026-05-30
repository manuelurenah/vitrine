import { expect, test } from './fixtures';
import { resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Onboarding flow', () => {
  test.beforeAll(async () => {
    await resetUserData();
  });

  test('walks welcome → input → generating → dna → next and unlocks the shell', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);

    // Welcome
    await page.waitForURL(/\/onboarding\/welcome/);
    await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible();
    await page.getByRole('link', { name: /let.s go/i }).click();

    // Input — fill at least one field so the CTA enables.
    await page.waitForURL(/\/onboarding\/input/);
    await expect(page.getByRole('heading', { name: /tell us who you are/i })).toBeVisible();
    await page
      .getByPlaceholder(/we make small-batch chili oil/i)
      .fill('small-batch hot sauce — austin · TX. customers are food nerds.');
    await page.getByRole('link', { name: /cook my dna/i }).click();

    // Generating — auto/manual progress in the design; just confirm it
    // renders, then click forward manually if a CTA is present.
    await page.waitForURL(/\/onboarding\/generating/);
    await expect(page.getByRole('heading', { name: /cooking your brand dna/i })).toBeVisible();
    // Jump straight to /dna — the GeneratingStep is animated client-side and
    // not deterministic enough to wait on. Onboarding state is recorded on
    // every navigation to a step, so this is safe.
    await page.goto(`${baseURL}/onboarding/dna`);

    // DNA
    await expect(page.getByRole('heading', { name: /your brand dna/i })).toBeVisible();
    await page.getByRole('link', { name: /let.s go/i }).click();

    // Next — terminal step. Visiting it sets completed_at; the layout gate
    // will then let us into /campaigns.
    await page.waitForURL(/\/onboarding\/next/);
    await expect(page.getByRole('heading', { name: /pick your first ship/i })).toBeVisible();

    // Picking "cook a campaign" navigates into the app shell, which is what
    // the gate is supposed to unlock.
    await page.getByRole('link', { name: /cook a campaign/i }).click();
    await page.waitForURL(/\/campaigns/);
    await expect(page.getByRole('heading', { name: /campaigns\./i })).toBeVisible();
  });
});
