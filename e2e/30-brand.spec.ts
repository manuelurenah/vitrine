import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

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

    // BrandEditor uses ColorPickerChip for palette swatches — no inline
    // #1a1a1a placeholder input. Flow:
    //   1. Click the + chip button to open the popover (aria-label="pick a custom brand color")
    //   2. Fill the hex input inside the popover (aria-label="hex value")
    //   3. Click "add color" to confirm
    //   4. The swatch hex (without #) appears as text in the palette strip
    await page.getByRole('button', { name: /pick a custom brand color/i }).click();
    // Popover renders a dialog; fill the hex input inside it.
    const hexInput = page.getByLabel(/hex value/i);
    await expect(hexInput).toBeVisible({ timeout: 5_000 });
    await hexInput.fill('#0f172a');
    await page.getByRole('button', { name: /add color/i }).click();

    // The palette swatch renders the hex without "#", e.g. "0f172a".
    await expect(page.getByText('0f172a', { exact: false })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /save changes/i }).click();
    // Save is a network round-trip to /api/brand/[id]; in CI that route
    // cold-compiles (Next dev) under load, so give it room beyond the 5s used
    // for client-only assertions above.
    await expect(page.getByText('saved.')).toBeVisible({ timeout: 15_000 });
  });

  test('assets gallery renders with empty state when no uploads', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/assets`);
    await expect(page.getByRole('heading', { name: /your asset library/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /upload your first/i })).toBeVisible();
  });
});
