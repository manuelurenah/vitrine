import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData, seedAsset, seedProduct } from './helpers/db';

/**
 * Legacy `?subject=<kind>:<id>` deep-links. The old subject-confirmation UI
 * (subject-panel / ProductRadioList) is gone; the wizard now folds a valid
 * subject into the read-only reference strip on the configure step, where it
 * shows up as a `reference-thumb`. The asset/product "use … photoshoot" links
 * themselves are unchanged — we keep asserting the deep-link they produce.
 */
test.describe('Photoshoot subject deep-links', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('asset detail → "use as photoshoot subject" → asset is a read-only reference', async ({
    page,
    baseURL,
  }) => {
    const assetId = await seedAsset({ kind: 'upload' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/assets/${assetId}`);

    // The asset-detail CTA link is unchanged.
    await page.getByRole('link', { name: /use as photoshoot subject/i }).click();

    // URL: /photoshoot/new?subject=asset:<id> (URL-encoded).
    await page.waitForURL(/\/photoshoot\/new\?subject=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const subject = url.searchParams.get('subject') ?? '';
    expect(subject).toBe(`asset:${assetId}`);

    // The wizard lands on configure; the subject is folded into refs and renders
    // as a read-only reference thumb (data-reference-id="asset:<id>").
    await expect(page.getByTestId('configure-step')).toBeVisible({ timeout: 15_000 });
    const thumb = page.locator(
      `[data-testid="reference-thumb"][data-reference-id="asset:${assetId}"]`,
    );
    await expect(thumb).toBeVisible({ timeout: 10_000 });
  });

  test('product detail → "use in photoshoot" → product is a read-only reference', async ({
    page,
    baseURL,
  }) => {
    const heroAssetId = await seedAsset({ kind: 'upload' });
    const productId = await seedProduct({ name: 'lumen hero', heroAssetId });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/catalog/${productId}`);

    // The photoshoot CTA lives in ProductDetailHeader as a "use in photoshoot"
    // anchor (links to /photoshoot/new?subject=product:<id>) — unchanged.
    await page.getByRole('link', { name: /use in photoshoot/i }).click();

    await page.waitForURL(/\/photoshoot\/new\?subject=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const subject = url.searchParams.get('subject') ?? '';
    expect(subject).toBe(`product:${productId}`);

    // On configure, the deep-linked product surfaces as a read-only reference
    // thumb (data-reference-id="product:<id>").
    await expect(page.getByTestId('configure-step')).toBeVisible({ timeout: 15_000 });
    const thumb = page.locator(
      `[data-testid="reference-thumb"][data-reference-id="product:${productId}"]`,
    );
    await expect(thumb).toBeVisible({ timeout: 10_000 });
  });
});
