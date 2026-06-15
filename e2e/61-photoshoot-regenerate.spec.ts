import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData, seedDonePhotoshoot } from './helpers/db';

/**
 * Photoshoot detail page — campaign-style rows.
 *
 * The detail page mirrors the campaign detail page: a compact header, a filter
 * bar, and one `pshoot-result-row` per tile/style. The old `pshoot-source-product`
 * reference and the per-template regenerate button were removed; regenerate now
 * lives as an item inside each image's `row-image-menu` (the ⋮ overlay).
 */
test.describe('photoshoot detail (row view)', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders the compact header, filters and per-tile rows', async ({ page, baseURL }) => {
    const { id, tileIds } = await seedDonePhotoshoot({ tileCount: 2, templateId: 'studio-clean' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${id}`);

    // Server-rendered header title.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

    // Filter bar is present.
    await expect(page.getByTestId('pshoot-filters')).toBeVisible({ timeout: 10_000 });

    // Both seeded tiles render as rows (the wrapper is kept mounted).
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pshoot-result-row')).toHaveCount(2);

    // Filtering by the seeded template's group ("studio") keeps both rows
    // visible (they share that group). The pill label text is rendered inside
    // an aria-hidden chip, so target it by scoped text rather than role+name.
    await page.getByTestId('pshoot-filters').getByText('studio · 2').click();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible();
  });

  test('row image menu → regenerate swaps the tile workflow', async ({ page, baseURL }) => {
    const { id } = await seedDonePhotoshoot({ tileCount: 1, templateId: 'studio-clean' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${id}`);

    // The seeded tile's workflow resolves (a generations row is seeded), so the
    // first image renders from the seeded `e2e-wf-*` poll.
    const firstImage = page.getByTestId('pshoot-result-row').first().locator('img').first();
    await expect(firstImage).toBeVisible({ timeout: 20_000 });
    const beforeSrc = await firstImage.getAttribute('src');
    expect(beforeSrc).toBeTruthy();

    // Open the image kebab menu and click regenerate. The POST returns a fresh
    // workflow id; the row swaps its poll to it (new MSW image url).
    const menu = page.getByTestId('row-image-menu').first();
    await menu.click();
    await page.getByRole('menuitem', { name: /regenerate/i }).click();

    // The regenerated workflow is a real MSW submit (`mock-imagegen-*`), so the
    // image src flips to a url containing that prefix once polling resolves.
    await expect(firstImage).toHaveAttribute('src', /mock-imagegen/, { timeout: 30_000 });
    const afterSrc = await firstImage.getAttribute('src');
    expect(afterSrc).not.toBe(beforeSrc);
  });
});
