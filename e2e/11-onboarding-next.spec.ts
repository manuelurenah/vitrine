import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { resetUserData } from './helpers/db';

/**
 * Onboarding "what's next" modal + keyboard nav.
 *
 * Each test starts with a fully-reset user (no onboarding_state row) so the
 * app treats the user as mid-onboarding and the session cookie gives us a
 * valid session. Visiting /onboarding/next directly is safe: the route only
 * checks for a valid session, calls recordOnboardingStep('next') which creates
 * the onboarding_state row and sets completed_at, then renders NextScreen.
 */
test.describe('onboarding next', () => {
  test.beforeEach(async () => {
    // Reset all user data — leave NO onboarding_state row so the user is
    // considered incomplete. Do NOT call markOnboardingComplete().
    await resetUserData();
  });

  test('next step renders as a full step screen with both choice cards', async ({
    page,
    baseURL,
  }) => {
    // Sign in — lands somewhere in /onboarding (welcome, since no state exists)
    await signInToApp(page, baseURL!);

    // Navigate directly to the terminal step
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
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    // Click the campaigns choice card (the whole button navigates)
    await page.getByTestId('next-choice-campaigns').click();
    await page.waitForURL(/\/campaigns$/);
  });

  test('clicking photoshoot card routes to /photoshoot', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    // Click the photoshoot choice card
    await page.getByTestId('next-choice-photoshoot').click();
    await page.waitForURL(/\/photoshoot$/);
  });

  test('back link routes to /onboarding/dna', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/onboarding/next`);
    await page.waitForURL(/\/onboarding\/next/);

    await page.getByTestId('next-back-link').click();
    await page.waitForURL(/\/onboarding\/dna$/);
  });

  test('dashboard fallback link routes to /campaigns', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
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
