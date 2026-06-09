import { expect, test } from './fixtures';
import {
  countRows,
  getAssetCollection,
  getProductAssetIds,
  markOnboardingComplete,
  resetUserData,
  seedAsset,
} from './helpers/db';
import { signInToApp } from './helpers/auth';

test.describe('Catalog + uploader library picker', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('library pick on new-product form → product with one product_assets row', async ({
    page,
    baseURL,
  }) => {
    const assetId = await seedAsset({ kind: 'upload', collection: 'references' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/catalog/new`);

    // Switch to the "pick from library" tab.
    await page.getByRole('tab', { name: /pick from library/i }).click();

    // The picker mounts on the assets tab (initialTab="assets") with the
    // seeded asset visible as an option.
    await expect(page.getByTestId('asset-catalog-picker')).toBeVisible();
    const option = page.getByRole('option').first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');

    // Fill the required product name.
    await page.getByLabel(/product name/i).fill('e2e library product');

    // Submit → POST /api/catalog/products.
    await page.getByRole('button', { name: /add to catalog/i }).click();

    // Redirects back to the catalog list.
    await page.waitForURL(/\/brand\/catalog$/, { timeout: 15_000 });

    // DB: one product with one product_assets row pointing at the library asset.
    expect(await countRows('products')).toBe(1);

    // Look up the freshly-created product id by name. countRows doesn't
    // return ids, so we read it back via the products list endpoint.
    const apiRes = await page.request.get(`${baseURL}/api/catalog/products`);
    expect(apiRes.ok()).toBeTruthy();
    const body = (await apiRes.json()) as { products: Array<{ id: string; name: string }> };
    const product = body.products.find((p) => p.name === 'e2e library product');
    expect(product).toBeDefined();

    const attached = await getProductAssetIds(product!.id);
    expect(attached).toEqual([assetId]);
  });

  test('AssetUploader library tab → promote re-tags collection without new row', async ({
    page,
    baseURL,
  }) => {
    const assetId = await seedAsset({ kind: 'upload', collection: 'references' });
    const beforeAssets = await countRows('assets');

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets/new`);

    // The library tab only renders when libraryAssets > 0, which the seed
    // above guarantees.
    await page.getByRole('tab', { name: /pick from library/i }).click();

    await expect(page.getByTestId('asset-catalog-picker')).toBeVisible();
    const option = page.getByRole('option').first();
    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');

    // Pick the `logos` collection (default is already `logos`, but be
    // explicit — the seeded asset is in `references`, so the promote action
    // labels itself "promote to library").
    await page.getByLabel(/collection/i).selectOption('logos');

    await page.getByRole('button', { name: /promote to library|re-tag/i }).click();

    // Redirects back to the assets list.
    await page.waitForURL(/\/brand\/assets$/, { timeout: 15_000 });

    // DB: same asset id, collection now `logos`. No new rows.
    expect(await countRows('assets')).toBe(beforeAssets);
    const collection = await getAssetCollection(assetId);
    expect(collection).toBe('logos');
  });
});
