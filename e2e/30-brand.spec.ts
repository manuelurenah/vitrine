import { expect, test } from './fixtures';
import { markOnboardingComplete, resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Brand pages render', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('brand DNA page renders default brand', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand`);
    await expect(page.getByText(/brand dna/i).first()).toBeVisible();
    // ensureDefaultBrand seeds "my brand" on first visit.
    await expect(page.getByText(/my brand/i).first()).toBeVisible();
  });

  test('brand editor saves a palette swatch', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand`);
    const swatchInput = page.getByPlaceholder('#1a1a1a');
    await swatchInput.fill('#0f172a');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('#0f172a')).toBeVisible();
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('saved.')).toBeVisible({ timeout: 5_000 });
  });

  test('assets gallery renders with empty state when no uploads', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets`);
    await expect(page.getByRole('heading', { name: /your asset library/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /upload your first/i })).toBeVisible();
  });
});
