import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData, seedDonePhotoshoot } from './helpers/db';

/**
 * Photoshoot detail page — grid-only layout.
 *
 * The detail page mirrors the campaign detail page: a compact header, a filter
 * bar, and a single flat grid of tiles (the former "by template" layout and its
 * per-template regenerate button were removed). Per-tile regenerate ("redo")
 * still lives on each CreativeCard; template-group regenerate now has no UI
 * surface (its API route + unit test remain).
 */
test.describe('photoshoot detail (grid view)', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders the compact header, filters and tile grid', async ({ page, baseURL }) => {
    const { id, tileIds } = await seedDonePhotoshoot({ tileCount: 2, templateId: 'studio-clean' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${id}`);

    // Server-rendered header: title + compact source-product reference.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pshoot-source-product')).toBeVisible({ timeout: 10_000 });

    // Filter bar is present.
    await expect(page.getByTestId('pshoot-filters')).toBeVisible({ timeout: 10_000 });

    // Both seeded tiles render in the flat grid.
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible({ timeout: 10_000 });

    // Filtering by the seeded template's group ("studio") keeps both tiles
    // visible (they share that group). The pill label text is rendered inside
    // an aria-hidden chip, so target it by scoped text rather than role+name.
    await page.getByTestId('pshoot-filters').getByText('studio · 2').click();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible();
  });
});
