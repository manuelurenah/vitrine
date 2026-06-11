import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countTileVersions,
  getTile,
  markOnboardingComplete,
  resetUserData,
  seedDoneCampaign,
} from './helpers/db';

test.describe('version history', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders all versions and diff', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 3 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}/history`);

    // Version history container is visible.
    await expect(page.getByTestId('version-history')).toBeVisible({ timeout: 15_000 });

    // All three version thumbs are rendered (strip is newest-first: 3,2,1).
    await expect(page.getByTestId('version-thumb-1')).toBeVisible();
    await expect(page.getByTestId('version-thumb-2')).toBeVisible();
    await expect(page.getByTestId('version-thumb-3')).toBeVisible();

    // The current-version badge appears (default selection is the latest).
    await expect(page.getByTestId('version-current-badge')).toBeVisible();

    // The diff panel is rendered.
    await expect(page.getByTestId('version-diff')).toBeVisible();
  });

  test('restore writes a new version and reverts the tile', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 3 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}/history`);

    await expect(page.getByTestId('version-history')).toBeVisible({ timeout: 15_000 });

    // Confirm 3 versions up front.
    expect(await countTileVersions(tileId)).toBe(3);

    // Auto-accept the confirm dialog triggered by the restore action.
    page.on('dialog', (d) => d.accept());

    // Select v2 (a non-current version) so the restore button becomes active.
    await page.getByTestId('version-thumb-2').click();

    // Restore button should now be enabled (v2 is not current).
    const restoreBtn = page.getByTestId('version-restore');
    await expect(restoreBtn).toBeEnabled({ timeout: 5_000 });

    // Click restore and wait for the POST response to succeed.
    const responsePromise = page.waitForResponse(
      (r) => /\/versions\/2$/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
      { timeout: 15_000 },
    );
    await restoreBtn.click();
    await responsePromise;

    // A new version (4) should have been written.
    expect(await countTileVersions(tileId)).toBe(4);

    // The tile's ad_copy headline should now reflect v2's content.
    const tile = await getTile(tileId);
    expect((tile?.adCopy as { headline?: string } | null)?.headline).toBe('head v2');
  });

  test('delete a non-current version succeeds', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 3 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}/history`);

    await expect(page.getByTestId('version-history')).toBeVisible({ timeout: 15_000 });

    // Auto-accept the confirm dialog triggered by the delete action.
    page.on('dialog', (d) => d.accept());

    // Select v1 (non-current, non-latest).
    await page.getByTestId('version-thumb-1').click();

    // Delete button should be enabled (v1 is not current, 3 versions exist).
    const deleteBtn = page.getByTestId('version-delete');
    await expect(deleteBtn).toBeEnabled({ timeout: 5_000 });

    // Click delete and wait for the DELETE response.
    const responsePromise = page.waitForResponse(
      (r) =>
        /\/versions\/1$/.test(r.url()) && r.request().method() === 'DELETE' && r.status() === 200,
      { timeout: 15_000 },
    );
    await deleteBtn.click();
    await responsePromise;

    // One version should have been removed.
    expect(await countTileVersions(tileId)).toBe(2);
  });

  test('delete current version is refused — button is disabled', async ({ page, baseURL }) => {
    const { id, tileId } = await seedDoneCampaign({ versions: 2 });
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}/c/${tileId}/history`);

    await expect(page.getByTestId('version-history')).toBeVisible({ timeout: 15_000 });

    // v2 is the current (latest) version; it is selected by default.
    await expect(page.getByTestId('version-current-badge')).toBeVisible();
    await page.getByTestId('version-thumb-2').click();

    // The UI must refuse: both action buttons are disabled while current is selected.
    const deleteBtn = page.getByTestId('version-delete');
    const restoreBtn = page.getByTestId('version-restore');
    await expect(deleteBtn).toBeDisabled({ timeout: 5_000 });
    await expect(restoreBtn).toBeDisabled();

    // No version should have been removed — still 2.
    expect(await countTileVersions(tileId)).toBe(2);
  });
});
