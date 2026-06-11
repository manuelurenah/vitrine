import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData, seedAsset, seedProduct } from './helpers/db';

test.describe('Photoshoot subject deep-links', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('asset detail → "use as photoshoot subject" pre-stages subject', async ({
    page,
    baseURL,
  }) => {
    const assetId = await seedAsset({ kind: 'upload' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets/${assetId}`);

    await page.getByRole('link', { name: /use as photoshoot subject/i }).click();

    // URL: /photoshoot/new?subject=asset:<id> (URL-encoded).
    await page.waitForURL(/\/photoshoot\/new\?subject=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const subject = url.searchParams.get('subject') ?? '';
    expect(subject).toBe(`asset:${assetId}`);

    // The wizard mounts in confirmation mode (subject set, picker closed).
    const panel = page.getByTestId('subject-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-subject-kind', 'asset');
    await expect(panel).toHaveAttribute('data-subject-id', assetId);
    await expect(page.getByTestId('subject-clear')).toBeVisible();
  });

  test('product detail → "use as photoshoot subject" pre-stages subject', async ({
    page,
    baseURL,
  }) => {
    const heroAssetId = await seedAsset({ kind: 'upload' });
    const productId = await seedProduct({ name: 'lumen hero', heroAssetId });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/catalog/${productId}`);

    // ProductDetailGallery CTA was renamed from "use as photoshoot subject" to "start photoshoot"
    await page.getByRole('link', { name: /start photoshoot/i }).click();

    await page.waitForURL(/\/photoshoot\/new\?subject=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const subject = url.searchParams.get('subject') ?? '';
    expect(subject).toBe(`product:${productId}`);

    // When the user has catalog products, the wizard renders ProductRadioList
    // (not SubjectPanel) — the product is pre-selected as a checked radio.
    const productRadio = page
      .getByRole('radiogroup', { name: /catalog products/i })
      .getByRole('radio', { checked: true });
    await expect(productRadio).toBeVisible({ timeout: 10_000 });
  });
});
