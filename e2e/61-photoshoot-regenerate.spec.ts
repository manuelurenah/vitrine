import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { countRows, markOnboardingComplete, resetUserData, seedDonePhotoshoot } from './helpers/db';

test.describe('photoshoot regenerate', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('per-template regenerate re-cooks the group and records audit', async ({
    page,
    baseURL,
  }) => {
    const { id, tileIds } = await seedDonePhotoshoot({ tileCount: 2, templateId: 'studio-clean' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${id}`);

    // Wait for the results page to render — at minimum the h1 title and the
    // source-product card should be visible. These come from the server-rendered
    // RSC, so they don't require polling or a generations row.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pshoot-source-product')).toBeVisible({ timeout: 10_000 });

    // The regenerate button for the seeded template must be present.
    const regenBtn = page.getByTestId('regenerate-template-studio-clean');
    await expect(regenBtn).toBeVisible({ timeout: 10_000 });

    // Both tile wrappers should be in the DOM.
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible({ timeout: 10_000 });

    // Baseline audit counts — seeded tiles have NO generations/buzz rows.
    const genBefore = await countRows('generations');
    const buzzBefore = await countRows('buzz_events');

    // Click the regenerate button and wait for the POST to succeed.
    await regenBtn.click();
    await page.waitForResponse(
      (r) =>
        r.url().includes(`/templates/studio-clean/regenerate`) &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 20_000 },
    );

    // One generation row per tile should have been recorded.
    expect(await countRows('generations')).toBe(genBefore + 2);
    // At least one buzz event per tile (estimate before submit).
    expect(await countRows('buzz_events')).toBeGreaterThanOrEqual(buzzBefore + 2);
  });

  test('filter and layout toggle keep tiles', async ({ page, baseURL }) => {
    const { id, tileIds } = await seedDonePhotoshoot({ tileCount: 2, templateId: 'studio-clean' });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/${id}`);

    // Wait for the results page.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

    // Filter bar visible.
    await expect(page.getByTestId('pshoot-filters')).toBeVisible({ timeout: 10_000 });

    // Tiles start in template layout — both are visible.
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible({ timeout: 10_000 });

    // Switch to grid layout — both tiles should still be present.
    await page.getByTestId('pshoot-layout-grid').click();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible();

    // Switch back to template layout — both tiles should still be present.
    await page.getByTestId('pshoot-layout-template').click();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[0]}`)).toBeVisible();
    await expect(page.getByTestId(`pshoot-tile-${tileIds[1]}`)).toBeVisible();
  });
});
