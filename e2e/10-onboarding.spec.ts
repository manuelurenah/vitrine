import { expect, test } from './fixtures';
import { resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Onboarding flow', () => {
  test.beforeEach(async () => {
    // Each test fully resets — payload + currentStep — so cases don't
    // depend on each other or on stale scrape state in onboarding_state.
    await resetUserData();
  });

  test('walks welcome → input → dna → next and unlocks the shell (no scrape)', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);

    // Welcome
    await page.waitForURL(/\/onboarding\/welcome/);
    await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible();
    await page.getByRole('link', { name: /let.s go/i }).click();

    // Input — no URL, just fill the manual description.
    await page.waitForURL(/\/onboarding\/input/);
    await expect(page.getByRole('heading', { name: /tell us who you are/i })).toBeVisible();
    await page
      .getByPlaceholder(/we make small-batch chili oil/i)
      .fill('small-batch hot sauce — austin · TX. customers are food nerds.');

    // The bottom "continue" button skips scrape entirely and routes straight
    // to /onboarding/dna.
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.waitForURL(/\/onboarding\/dna/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /your brand dna/i })).toBeVisible();
    await page.getByRole('link', { name: /let.s go/i }).click();

    // Next — terminal step. Visiting it sets completed_at; the layout gate
    // will then let us into /campaigns.
    await page.waitForURL(/\/onboarding\/next/);
    await expect(page.getByRole('heading', { name: /pick your first ship/i })).toBeVisible();
    await page.getByRole('link', { name: /cook a campaign/i }).click();
    await page.waitForURL(/\/campaigns/);
    await expect(page.getByRole('heading', { name: /campaigns\./i })).toBeVisible();
  });

  test('blocks continue when the entered url is malformed', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.waitForURL(/\/onboarding\/welcome/);
    await page.getByRole('link', { name: /let.s go/i }).click();
    await page.waitForURL(/\/onboarding\/input/);

    await page.getByPlaceholder('your-shop.co').fill('not a url');
    // The extract button lives inside the URL card.
    await page.getByRole('button', { name: /extract \+ continue/i }).click();

    // Inline error appears and the route does NOT change.
    await expect(page.getByText(/doesn.t look right/i)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/input/);
  });

  test('scrape runs in the processing step and dna shows extracted data', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.waitForURL(/\/onboarding\/welcome/);
    await page.getByRole('link', { name: /let.s go/i }).click();
    await page.waitForURL(/\/onboarding\/input/);

    // Drop a public-resolving URL that MSW intercepts.
    await page.getByPlaceholder('your-shop.co').fill('example.com');

    // CTA label flips to "extract + continue" when URL is present.
    await page.getByRole('button', { name: /extract \+ continue/i }).click();

    // Processing step — visible transitional UI while scrape runs.
    await page.waitForURL(/\/onboarding\/processing/);
    await expect(page.getByRole('heading', { name: /cooking your brand dna/i })).toBeVisible();

    // Auto-advances to dna once tasks complete.
    await page.waitForURL(/\/onboarding\/dna/, { timeout: 20_000 });

    // DnaStep is a single screen now — all cards render inline.
    await expect(page.getByText(/scraped from example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder('your brand name')).toHaveValue('Acme Brews');
    await expect(page.getByAltText(/acme brews logo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/any google font/i)).toHaveValue('Bricolage Grotesque');
    await expect(page.locator('textarea').first()).toHaveValue(/cold-brew coffee/i);
  });

  test('dna step persists tagline + tone edits across refresh', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.waitForURL(/\/onboarding\/welcome/);
    await page.getByRole('link', { name: /let.s go/i }).click();
    await page.waitForURL(/\/onboarding\/input/);

    await page.getByPlaceholder('your-shop.co').fill('example.com');
    await page.getByRole('button', { name: /extract \+ continue/i }).click();
    await page.waitForURL(/\/onboarding\/processing/);
    await page.waitForURL(/\/onboarding\/dna/, { timeout: 20_000 });

    // Single-screen layout — every editable card is visible immediately.
    await page.getByPlaceholder(/small-batch heat/i).fill('cold by design.');
    await page.getByPlaceholder(/add tone/i).fill('punchy');
    await page.getByPlaceholder(/add tone/i).press('Enter');
    await expect(page.getByText('punchy')).toBeVisible();

    // Wait for debounced patch then hard-refresh to confirm persistence.
    await page.waitForTimeout(1_200);
    await page.goto(`${baseURL}/onboarding/dna`);
    await expect(page.getByPlaceholder(/small-batch heat/i)).toHaveValue('cold by design.');
    await expect(page.getByText('punchy')).toBeVisible();
  });

  test('persists manual input across step navigation', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.waitForURL(/\/onboarding\/welcome/);
    await page.getByRole('link', { name: /let.s go/i }).click();
    await page.waitForURL(/\/onboarding\/input/);

    // Type a description without entering a URL — exercises the payload
    // patch route only (no scrape, no clobbering).
    const desc = 'we sell hand-rolled candles out of a coffee shop in lisbon.';
    await page.getByPlaceholder(/we make small-batch chili oil/i).fill(desc);

    // Debounced patch fires after 500ms; wait long enough for the network
    // round-trip to land before we navigate.
    await page.waitForTimeout(1_200);

    // Leave the page entirely and come back via a hard navigation, which
    // forces re-fetch from the DB (rather than relying on client state).
    await page.goto(`${baseURL}/onboarding/welcome`);
    await page.getByRole('link', { name: /let.s go/i }).click();
    await page.waitForURL(/\/onboarding\/input/);

    await expect(page.getByPlaceholder(/we make small-batch chili oil/i)).toHaveValue(desc);
  });
});
