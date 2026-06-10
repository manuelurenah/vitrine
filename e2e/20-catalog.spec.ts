import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Catalog CRUD', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('creates a product, lists it, and deletes it', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/catalog`);
    await expect(page.getByRole('heading', { name: /your products/i })).toBeVisible();

    await page.goto(`${baseURL}/brand/catalog/new`);
    await expect(page.getByRole('heading', { name: /add a product/i })).toBeVisible();

    const productName = `e2e mug ${Date.now()}`;
    await page.getByLabel(/product name/i).fill(productName);
    await page.getByLabel(/sku/i).fill('E2E-001');
    await page.getByLabel(/tags/i).fill('hero, e2e');
    await page.getByLabel(/notes/i).fill('test product created by playwright.');
    await page.getByRole('button', { name: /add to catalog/i }).click();

    await page.waitForURL(/\/brand\/catalog$/, { timeout: 15_000 });
    await expect(page.getByText(productName, { exact: false })).toBeVisible();

    // Open the detail page; CatalogGrid links to /brand/catalog/[id].
    await page.getByText(productName).first().click();
    await page.waitForURL(/\/brand\/catalog\/[\w-]+$/);
    await expect(page.getByRole('heading', { name: productName })).toBeVisible();

    const deleteBtn = page.getByRole('button', { name: /delete/i });
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once('dialog', (d) => d.accept());
      await deleteBtn.click();
      await page.waitForURL(/\/brand\/catalog$/, { timeout: 15_000 });
      await expect(page.getByText(productName)).toHaveCount(0);
    }
  });
});
