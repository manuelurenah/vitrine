import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countTileVersions,
  markOnboardingComplete,
  resetUserData,
  seedDoneVariantGroup,
} from './helpers/db';

test.describe('per-variant editing', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('the detail page shows one row of N editable variant thumbnails', async ({
    page,
    baseURL,
  }) => {
    const { id, tileIds } = await seedDoneVariantGroup(3);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}`);

    // One creative row, three variant thumbnails (each an "edit creative" link).
    await expect(page.getByTestId('campaign-creative-row')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'edit creative' })).toHaveCount(3);

    // Each thumbnail links to its OWN tile editor.
    const hrefs = await page
      .getByRole('link', { name: 'edit creative' })
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')));
    for (const tileId of tileIds) {
      expect(hrefs.some((h) => h?.includes(`/c/${tileId}`))).toBe(true);
    }
  });

  test('editing one variant writes a version only for that variant', async ({ page, baseURL }) => {
    const { id, tileIds } = await seedDoneVariantGroup(3);
    const [tile0, tile1] = tileIds;
    await signInToApp(page, baseURL!);

    // Open variant #1's editor directly.
    await page.goto(`${baseURL}/campaigns/${id}/c/${tile1}`);
    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });

    expect(await countTileVersions(tile1!)).toBe(1);
    expect(await countTileVersions(tile0!)).toBe(1);

    const headerField = page.getByTestId('editor-field-header');
    await headerField.clear();
    await headerField.fill('variant one edited');
    await page.getByTestId('editor-save').click();
    await page.waitForResponse(
      (r) =>
        r.url().includes(`/tiles/${tile1}/regenerate`) &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 15_000 },
    );

    // Only variant #1 gains a new version; its sibling is untouched.
    expect(await countTileVersions(tile1!)).toBe(2);
    expect(await countTileVersions(tile0!)).toBe(1);
  });
});
