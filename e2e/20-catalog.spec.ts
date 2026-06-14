import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { countRows, markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Catalog CRUD', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('creates a product, lists it, and deletes it', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/catalog`);
    await expect(page.getByRole('heading', { name: /your products/i })).toBeVisible();

    await page.goto(`${baseURL}/catalog/new`);
    await expect(page.getByRole('heading', { name: /add a product/i })).toBeVisible();

    // AddProductForm has: product name, description (optional), tags (optional).
    // There is no SKU field — the products table has a sku column but the form
    // intentionally does not collect it.
    // "add to catalog" (live submit) requires at least one image; use "save as
    // draft" for a no-image CRUD test — the form allows draft without images.
    const productName = `e2e mug ${Date.now()}`;
    await page.getByLabel(/product name/i).fill(productName);
    await page.getByLabel(/tags/i).fill('hero, e2e');
    await page.getByLabel(/description/i).fill('test product created by playwright.');
    await page.getByRole('button', { name: /save as draft/i }).click();

    await page.waitForURL(/\/catalog$/, { timeout: 15_000 });
    await expect(page.getByText(productName, { exact: false })).toBeVisible();

    // DB: one product row should exist.
    expect(await countRows('products')).toBe(1);

    // Open the detail page. The catalog grid card is an overlaid Link whose
    // hover-reveal "•••" menu makes a direct card click flaky, so resolve the
    // product id via the API and navigate to the detail route directly.
    const listRes = await page.request.get(`${baseURL}/api/catalog/products`);
    const listBody = (await listRes.json()) as { products: Array<{ id: string; name: string }> };
    const created = listBody.products.find((p) => p.name === productName);
    expect(created).toBeDefined();
    await page.goto(`${baseURL}/catalog/${created!.id}`);
    await expect(page.getByRole('heading', { name: productName })).toBeVisible();

    // Delete is inside the context menu (•••) in the detail header.
    // ProductDetailHeader renders: button[aria-label="more product actions"] →
    // menu → button[role="menuitem"] "delete product" → window.confirm →
    // router.push('/catalog')
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /more product actions/i }).click();
    await page.getByRole('menuitem', { name: /delete product/i }).click();

    await page.waitForURL(/\/catalog$/, { timeout: 15_000 });
    await expect(page.getByText(productName)).toHaveCount(0);

    // DB confirms deletion.
    expect(await countRows('products')).toBe(0);
  });
});
