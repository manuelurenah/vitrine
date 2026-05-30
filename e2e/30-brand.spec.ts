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

  test('brand book page renders', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/book`);
    await expect(page.getByText(/brand book/i).first()).toBeVisible();
  });

  test('assets gallery renders with empty state when no uploads', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets`);
    await expect(page.getByRole('heading', { name: /your asset library/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /upload your first/i })).toBeVisible();
  });
});
