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

/**
 * Photoshoot detail → cross-flow actions. The select-mode + bulk action bar are
 * gone; "use as product image" and "use in campaign" now live as menu items
 * inside each image's `row-image-menu` (the ⋮ button per image). Only the first
 * image of a tile has a linked asset id, so those items are enabled there.
 */
test.describe('Photoshoot cross-flow', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('row image menu → use in campaign deep-links the wizard with refs', async ({
    page,
    baseURL,
  }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 1 });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    // Open the first row image's kebab menu, then "use in campaign".
    const menu = page.getByTestId('row-image-menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await menu.click();

    await page.getByRole('menuitem', { name: /use in campaign/i }).click();

    // URL: /campaigns/new?refs=<encoded asset:<id>>
    await page.waitForURL(/\/campaigns\/new\?refs=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const refs = url.searchParams.get('refs') ?? '';
    expect(refs).toContain(`asset:${shoot.assetIds[0]}`);

    // The campaign wizard surfaces the picker on the brief step — the pre-staged
    // reference shows up as a selection.
    await expect(page.getByTestId('asset-catalog-picker')).toBeVisible();
  });

  test('row image menu → use as product image → attach to existing product', async ({
    page,
    baseURL,
  }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 1 });
    const productId = await seedProduct({ name: 'lumen primary' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    const menu = page.getByTestId('row-image-menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await menu.click();
    await page.getByRole('menuitem', { name: /use as product image/i }).click();

    // Picker dialog → pick the seeded product by name.
    await expect(page.getByTestId('product-picker-dialog')).toBeVisible();
    await page.getByTestId(`product-picker-item-${productId}`).click();

    // Navigates to the product detail page.
    await page.waitForURL(new RegExp(`/catalog/${productId}$`), { timeout: 15_000 });

    // DB: the photoshoot asset is now attached to this product.
    const attached = await getProductAssetIds(productId);
    expect(attached).toContain(shoot.assetIds[0]);
  });

  test('row image menu → use as product image → + new product carries the image', async ({
    page,
    baseURL,
  }) => {
    const shoot = await seedDonePhotoshoot({ tileCount: 1 });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${shoot.id}`);

    const menu = page.getByTestId('row-image-menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await menu.click();
    await page.getByRole('menuitem', { name: /use as product image/i }).click();

    await expect(page.getByTestId('product-picker-dialog')).toBeVisible();

    // No products exist → only the "+ new product" CTA renders.
    await page.getByTestId('product-picker-new').first().click();

    // URL contains the encoded `images=` list of asset tokens.
    await page.waitForURL(/\/catalog\/new\?images=/, { timeout: 10_000 });
    const url = new URL(page.url());
    const images = url.searchParams.get('images') ?? '';
    expect(images).toContain(`asset:${shoot.assetIds[0]}`);

    // No products were created by the picker shortcut.
    expect(await countRows('products')).toBe(0);

    // The product form lands on the library tab with the pre-staged thumb.
    await expect(page.getByText(/1 of 8 staged/i)).toBeVisible();
  });
});
