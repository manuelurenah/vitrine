import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countRows,
  markOnboardingComplete,
  resetUserData,
  seedAsset,
  testUserId,
} from './helpers/db';

test.describe('account deletion', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('confirm button gates on exact username', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/settings`);

    await page.getByTestId('delete-account-open').click();

    const confirm = page.getByTestId('delete-account-confirm');
    await expect(confirm).toBeDisabled();

    const username =
      (await page.getByTestId('delete-account-username').textContent())?.trim() ?? '';
    expect(username.length).toBeGreaterThan(0);

    await page.getByTestId('delete-account-input').fill('not-the-username');
    await expect(confirm).toBeDisabled();

    await page.getByTestId('delete-account-input').fill(username);
    await expect(confirm).toBeEnabled();
  });

  test('deletes the account and logs the user out', async ({ page, baseURL }) => {
    await seedAsset({ kind: 'upload' });
    expect(await countRows('assets')).toBe(1);

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/settings`);

    await page.getByTestId('delete-account-open').click();
    const username =
      (await page.getByTestId('delete-account-username').textContent())?.trim() ?? '';
    await page.getByTestId('delete-account-input').fill(username);
    await page.getByTestId('delete-account-confirm').click();

    // Redirected to the logged-out root.
    await expect(page).toHaveURL(`${baseURL}/`, { timeout: 15_000 });

    // All vitrine data for the user is gone.
    expect(await countRows('assets', testUserId)).toBe(0);
    expect(await countRows('onboarding_state', testUserId)).toBe(0);
  });
});
