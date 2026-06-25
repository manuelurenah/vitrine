import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { resetUserData } from './helpers/db';

/**
 * Onboarding "what's next" terminal step + keyboard nav.
 *
 * Each test starts with a fully-reset user (no onboarding_state row) so the
 * app treats the user as mid-onboarding and the session cookie gives us a
 * valid session.
 *
 * Completion is gated on brand DNA: reaching /onboarding/next runs
 * recordOnboardingStep('next'), which only sets completed_at when the
 * onboarding PAYLOAD has sufficient brand DNA (a real brand name plus a
 * description or at least one color). A user who reaches /onboarding/next
 * WITHOUT that data is NOT completed and gets server-redirected back to
 * /onboarding/input. To exercise the "completed" path we first seed a
 * sufficient payload via POST /api/onboarding/payload.
 */

/** Seed a sufficient brand-DNA payload so the completion gate fires. */
async function seedBrandDna(
  page: import('@playwright/test').Page,
  baseURL: string,
): Promise<void> {
  const res = await page.request.post(`${baseURL}/api/onboarding/payload`, {
    data: { brandName: 'austin heat co', description: 'small-batch hot sauce from austin' },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe('onboarding next', () => {
  test.beforeEach(async () => {
    // Reset all user data — leave NO onboarding_state row so the user is
    // considered incomplete. Do NOT call markOnboardingComplete().
    await resetUserData();
  });

  test('redirects back to /onboarding/input when brand DNA is insufficient', async ({
    page,
    baseURL,
  }) => {
    // Sign in — lands somewhere in /onboarding (welcome, since no state exists).
    await signInToApp(page, baseURL!);

    // Navigate directly to the terminal step with NO brand DNA seeded. The
    // server gate leaves completed_at null and redirects back to the input step.
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/input/);
    await expect(page.getByRole('heading', { name: /tell us who you are/i })).toBeVisible();
  });

  test('next step renders as a full step screen with both choice cards', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await seedBrandDna(page, baseURL!);

    // Navigate directly to the terminal step — now allowed (DNA is sufficient).
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    // Rendered inline as a step (no modal, no dimmed DNA scrim behind it)
    await expect(page.getByRole('heading', { name: /your brand DNA is.*ready/i })).toBeVisible();
    await expect(page.getByTestId('next-choice-modal')).toHaveCount(0);
    await expect(page.getByTestId('next-dna-behind')).toHaveCount(0);

    // Both choice cards are visible
    await expect(page.getByTestId('next-choice-campaigns')).toBeVisible();
    await expect(page.getByTestId('next-choice-photoshoot')).toBeVisible();

    // No Buzz estimate on this screen — cost depends on params chosen inside each tool
    await expect(page.getByTestId('next-choice').getByText(/buzz/i)).toHaveCount(0);
  });

  test('clicking campaigns card routes to /campaigns', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await seedBrandDna(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    // Click the campaigns choice card (the whole button navigates)
    await page.getByTestId('next-choice-campaigns').click();
    await page.waitForURL(/\/campaigns$/);
  });

  test('clicking photoshoot card routes to /photoshoot', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await seedBrandDna(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    // Click the photoshoot choice card
    await page.getByTestId('next-choice-photoshoot').click();
    await page.waitForURL(/\/photoshoot$/);
  });

  test('back link routes to /onboarding/dna', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await seedBrandDna(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    await page.getByTestId('next-back-link').click();
    await page.waitForURL(/\/onboarding\/dna$/);
  });

  test('dashboard fallback link routes to /campaigns', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await seedBrandDna(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    await page.getByTestId('next-dashboard-link').click();
    await page.waitForURL(/\/campaigns$/);
  });

  test('arrow keys navigate between onboarding steps', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);

    // Navigate to the 'input' step (non-terminal, has both prev and next)
    await page.goto(`${baseURL}/onboarding/input`);
    // Wait for the heading to confirm the page is rendered and interactive
    await expect(page.getByRole('heading', { name: /tell us who you are/i })).toBeVisible();

    // The input step gates ArrowRight on form validity (canLeaveInputStep), so
    // fill a brand name + description first or forward nav is blocked.
    await page.getByPlaceholder(/lumen skincare/i).fill('austin heat co');
    await page
      .getByPlaceholder(/we make small-batch chili oil/i)
      .fill('small-batch hot sauce from austin');

    // Blur any focused element so the keyboard nav hook isn't suppressed.
    // We do this via evaluate to avoid clicking interactive elements.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    // Dispatch ArrowRight directly on the window — same path the hook listens on.
    // This is more reliable than page.keyboard.press() which targets the focused
    // element and can be swallowed by scroll behaviour or unrelated listeners.
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    await page.waitForURL(/\/onboarding\/processing/, { timeout: 15_000 });

    // Wait for the processing page to stabilise, then go back with ArrowLeft
    await expect(page.getByRole('heading', { name: /cooking your brand dna/i })).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    await page.waitForURL(/\/onboarding\/input/, { timeout: 15_000 });
  });
});
