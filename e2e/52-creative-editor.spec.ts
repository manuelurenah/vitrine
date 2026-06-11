import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countRows,
  countTileVersions,
  getTile,
  markOnboardingComplete,
  resetUserData,
  seedDoneCampaign,
} from './helpers/db';

test.describe('creative editor', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders editor for a done tile', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 1 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}`);

    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('editor-version-label')).toContainText(/1\s*\/\s*1/);
    // Canvas image renders from the seeded asset URL (no polling required).
    await expect(page.locator('img').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('editor-regenerate')).toBeVisible();
    await expect(page.getByTestId('editor-fix-layout')).toBeVisible();
  });

  test('field edit persists and writes a version', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 1 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}`);

    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });
    expect(await countTileVersions(tileId)).toBe(1);

    // Clear and fill the headline field.
    const headerField = page.getByTestId('editor-field-header');
    await headerField.clear();
    await headerField.fill('e2e new headline');

    // Click save and wait for the PATCH to complete.
    await page.getByTestId('editor-save').click();
    await page.waitForResponse(
      (r) => r.url().includes(`/tiles/${tileId}`) && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 15_000 },
    );

    // A new tile_version row should have been written.
    expect(await countTileVersions(tileId)).toBe(2);

    // The tile's persisted ad_copy headline should match what we typed.
    const tile = await getTile(tileId);
    expect((tile?.adCopy as { headline?: string } | null)?.headline).toBe('e2e new headline');
  });

  test('regenerate re-cooks the tile', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 1 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}`);

    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });

    const before = await countRows('generations');

    await page.getByTestId('editor-regenerate').click();
    await page.waitForResponse(
      (r) =>
        r.url().includes(`/tiles/${tileId}/regenerate`) &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 15_000 },
    );

    expect(await countRows('generations')).toBe(before + 1);

    // After regeneration the MSW orchestrator progresses through pending →
    // processing → succeeded; the image appears after polling succeeds.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });

  test('fix-layout sends a promptHint', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 1 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}`);

    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });

    const before = await countRows('generations');

    // Intercept the request BEFORE clicking so we don't miss it.
    const reqP = page.waitForRequest(
      (r) => r.url().includes(`/tiles/${tileId}/regenerate`) && r.method() === 'POST',
      { timeout: 15_000 },
    );

    await page.getByTestId('editor-fix-layout').click();

    const req = await reqP;
    const body = req.postDataJSON() as { promptHint?: string } | null;
    expect(body?.promptHint).toBeTruthy();

    // Wait for the response to confirm it was accepted.
    await page.waitForResponse(
      (r) =>
        r.url().includes(`/tiles/${tileId}/regenerate`) &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 15_000 },
    );

    // A new generation row should have been recorded.
    expect(await countRows('generations')).toBe(before + 1);
  });
});
