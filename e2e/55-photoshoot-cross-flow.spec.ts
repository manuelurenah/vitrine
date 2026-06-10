import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countRows,
  getProductAssetIds,
  markOnboardingComplete,
  resetUserData,
  seedDonePhotoshoot,
  seedProduct,
} from './helpers/db';

test.describe('Photoshoot cross-flow', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('per-tile menu → use in campaign deep-links the wizard with refs', async ({
    page,
    baseURL,
  }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 1 });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    // Per-tile kebab → menu → "use in campaign"
    const tileMenu = page.getByRole('button', { name: 'tile actions' }).first();
    await expect(tileMenu).toBeVisible();
    await tileMenu.click();

    await page.getByRole('menuitem', { name: /use in campaign/i }).click();

    // URL: /campaigns/new?refs=<encoded asset:<id>>
    await page.waitForURL(/\/campaigns\/new\?refs=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const refs = url.searchParams.get('refs') ?? '';
    expect(refs).toContain(`asset:${shoot.assetIds[0]}`);

    // The campaign wizard surfaces the picker on the brief step — the
    // pre-staged reference shows up as a selection.
    await expect(page.getByTestId('asset-catalog-picker')).toBeVisible();
  });

  test('multi-select bulk → attach to existing product', async ({ page, baseURL }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 2 });
    const productId = await seedProduct({ name: 'lumen primary' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    // Enter select mode + tick both done tiles. Each tile renders an overlay
    // button with aria-label "select tile" (or "deselect tile" when ticked).
    await page.getByRole('button', { name: /^select$/i }).click();
    const tileOverlays = page.getByRole('button', { name: /^select tile$/i });
    await expect(tileOverlays).toHaveCount(2);
    await tileOverlays.nth(0).click();
    // After the first click the first overlay flips to "deselect tile",
    // leaving exactly one "select tile" button — click it.
    await page
      .getByRole('button', { name: /^select tile$/i })
      .first()
      .click();

    // Bulk bar → "add to product (2)"
    const bulkAdd = page.getByRole('button', { name: /add to product \(2\)/i });
    await expect(bulkAdd).toBeEnabled();
    await bulkAdd.click();

    // Picker dialog → pick the seeded product by name.
    await expect(page.getByTestId('product-picker-dialog')).toBeVisible();
    await page.getByTestId(`product-picker-item-${productId}`).click();

    // Navigates to the product detail page.
    await page.waitForURL(new RegExp(`/brand/catalog/${productId}$`), { timeout: 15_000 });

    // DB: 2 product_assets rows attached to this product.
    const attached = await getProductAssetIds(productId);
    expect(attached.length).toBe(2);
    expect(new Set(attached)).toEqual(new Set(shoot.assetIds));
  });

  test('multi-select bulk → + new product carries images via querystring', async ({
    page,
    baseURL,
  }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 2 });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    await page.getByRole('button', { name: /^select$/i }).click();
    const tileOverlays = page.getByRole('button', { name: /^select tile$/i });
    await expect(tileOverlays).toHaveCount(2);
    await tileOverlays.nth(0).click();
    await page
      .getByRole('button', { name: /^select tile$/i })
      .first()
      .click();

    await page.getByRole('button', { name: /add to product \(2\)/i }).click();
    await expect(page.getByTestId('product-picker-dialog')).toBeVisible();

    // No products exist → only the empty-state "+ new product" CTA renders.
    await page.getByTestId('product-picker-new').first().click();

    // URL contains the encoded `images=` list of asset tokens.
    await page.waitForURL(/\/brand\/catalog\/new\?images=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const images = url.searchParams.get('images') ?? '';
    for (const aid of shoot.assetIds) {
      expect(images).toContain(`asset:${aid}`);
    }

    // No products were created by the picker shortcut.
    expect(await countRows('products')).toBe(0);

    // The product form lands on the library tab with 2 pre-staged thumbs.
    await expect(page.getByText(/2 of 8 staged/i)).toBeVisible();
  });
});
