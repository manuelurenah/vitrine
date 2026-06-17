import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

/**
 * Civitai ad formats are campaign OUTPUT-FORMAT presets (platform:'civitai-ads',
 * exact:true) grouped under a "civitai ads" section in the wizard's PresetGrid.
 * They cook through the normal campaign flow at their nearest aspect ratio @ 2K,
 * and the exact-pixel deliverable is produced by a server-side sharp crop in the
 * export + per-creative download routes.
 *
 * This spec mirrors 50-campaigns' cook/poll harness but selects a Civitai Ads
 * format (rectangle · 300×250 → preset id `ad-rectangle-300x250`) and asserts
 * the ad creative finishes and the export affordance is present.
 */
test.describe('Campaign wizard — Civitai ad-format creatives', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('cook an ad-format creative through the campaign flow → tile finishes + export affordance', async ({
    page,
    baseURL,
  }) => {
    // Generous timeout: the auto-draft hits an LLM chain that can retry across
    // models before the brief step renders.
    test.setTimeout(180_000);

    await signInToApp(page, baseURL!);

    // Arrive WITH a prompt → wizard auto-drafts and lands on the brief step,
    // where the PresetGrid (output formats) lives.
    const prompt = 'banner-ready chili-oil launch — bold hero, crop-safe centered subject';
    await page.goto(`${baseURL}/campaigns/new?prompt=${encodeURIComponent(prompt)}`);

    await expect(page.getByTestId('drafting-overlay')).toBeVisible();
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });

    // Select a Civitai Ads format from the PresetGrid. The ad tiles are buttons
    // labelled with their human size (e.g. "rectangle · 300×250") and toggle
    // aria-pressed. Pick by accessible name, then confirm it's selected.
    const adTile = page.getByRole('button', { name: /rectangle · 300×250/i });
    await expect(adTile).toBeVisible();
    await adTile.click();
    await expect(adTile).toHaveAttribute('aria-pressed', 'true');

    // The per-placement copy card for the selected ad preset confirms it joined
    // the cook set (cards are keyed by preset id).
    await expect(page.getByTestId('adcopy-card-ad-rectangle-300x250')).toBeVisible();

    // Wait for the buzz preview so cooking has a real estimate (mirrors
    // 50-campaigns gating advanced on the preview return).
    await expect(page.getByTestId('total-buzz')).toBeVisible({ timeout: 20_000 });

    // Cook.
    await page.getByTestId('brief-cook').click();

    // Redirect to the campaign detail page.
    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // The ad creative's row renders (grouped by preset). At least one creative
    // row should be present, including the rectangle preset's label.
    await expect(page.getByTestId('campaign-creative-row').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/rectangle · 300×250/i).first()).toBeVisible();

    // The ad tile finishes: a skeleton flips to a real <img> once the MSW poll
    // reaches succeeded (pending → processing → succeeded). Mirrors how
    // 50-campaigns asserts completion. The client poll also flips the DB tile to
    // `done` (syncAssetsFromSnapshot), creating the asset the crop export reads.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });

    // The export affordance is present (the campaign ZIP export — the route that
    // crops ad tiles to exact pixels via sharp).
    const exportBtn = page.getByRole('button', { name: /export zip/i });
    await expect(exportBtn).toBeVisible();

    // The button's `disabled` reflects the server-rendered done-count, which was
    // still 0 at first navigation (tiles were cooking). After the poll flips the
    // tile to `done` in the DB, a reload re-renders the detail page with the ad
    // creative present, and the export affordance becomes enabled — proving the
    // cooked ad creative is exportable.
    await page.reload();
    await expect(page.getByText(/rectangle · 300×250/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /export zip/i })).toBeEnabled({
      timeout: 30_000,
    });
  });
});
