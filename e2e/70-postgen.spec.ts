import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

/**
 * Post-generation actions — upscale + animate. Starts from a fresh campaign
 * cook, waits for the first tile to land an image, then exercises the
 * actions-menu → confirm → child-card polling flow for both actions.
 *
 * The MSW handlers in `src/mocks/handlers.ts` ship distinct response shapes
 * per step type:
 *   - imageUpscaler → single `images[0].url` on succeeded snapshot
 *   - videoGen      → `images[0]` poster + `blobs[0]` with mimeType `video/mp4`
 *
 * The post-gen chips live in a dropdown opened by the "image actions" button
 * (MoreHorizontal hamburger in the top-right of each overlay). Hover alone
 * does NOT reveal them — the menu button must be explicitly clicked.
 *
 * Child cards are absolutely positioned inside the image overlay container
 * which has overflow:hidden; assert the container card testid for visibility,
 * not the inner <img> / <video>, to avoid overflow-clipping false-negatives.
 */

test.describe('Post-generation actions (upscale + animate)', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('upscale + animate from a completed campaign tile', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signInToApp(page, baseURL!);

    // ----- cook a campaign (CampaignWizard: prompt-step → brief-step → cook) -----
    // The draft call hits the LLM chain which can fall back across models (up
    // to ~30s); allow 60s for brief-step to appear, matching 99-generation.
    await page.goto(`${baseURL}/campaigns/new`);
    await expect(page.getByTestId('prompt-step')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('prompt-input').fill('chili oil summer launch — warm tones, bold copy');
    await page.getByTestId('prompt-continue').click();
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('brief-cook').click();
    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });

    // ----- wait for the first generated image to render -----
    const firstImage = page.locator('[data-image-overlay] img').first();
    await expect(firstImage).toBeVisible({ timeout: 30_000 });

    // ----- upscale: open the actions menu, click the upscale chip -----
    const overlays = page.locator('[data-image-overlay]');
    const upscaleOverlay = overlays.first();
    await upscaleOverlay.getByRole('button', { name: /image actions/i }).click();

    // The dropdown menu is portaled to document.body (so it escapes the image
    // slot's overflow-hidden), so scope chip lookups to the page, not the
    // overlay. Only one menu is open at a time → the testid is unique.
    const upscaleChip = page.getByTestId('post-gen-chip-upscale-2-');
    await expect(upscaleChip).toBeVisible();
    // Buzz cost preview is rendered as part of the chip — "buzz" suffix or
    // "estimate…" prelude.
    await expect(upscaleChip).toContainText(/buzz|estimat/i);
    await upscaleChip.click();

    const upscaleConfirm = upscaleOverlay.getByTestId('post-gen-confirm-upscale');
    await expect(upscaleConfirm).toBeVisible();
    // Cost preview surfaces inside the confirm panel.
    await expect(upscaleConfirm).toContainText(/buzz|estimat/i);
    await upscaleOverlay.getByTestId('post-gen-confirm-upscale-go').click();

    // Child card container appears + polls. Assert the container, not the inner
    // <img>, to avoid overflow-clipping false-negatives.
    await expect(page.getByTestId('post-gen-child-upscale').first()).toBeVisible({
      timeout: 60_000,
    });

    // ----- animate: pick a sibling overlay if available -----
    const overlayCount = await overlays.count();
    const animateOverlay = overlayCount > 1 ? overlays.nth(1) : upscaleOverlay;
    await animateOverlay.getByRole('button', { name: /image actions/i }).click();

    const animateChip = page.getByTestId('post-gen-chip-animate');
    await expect(animateChip).toBeVisible();
    await expect(animateChip).toContainText(/buzz|estimat/i);
    await animateChip.click();

    const animateConfirm = animateOverlay.getByTestId('post-gen-confirm-animate');
    await expect(animateConfirm).toBeVisible();
    await expect(animateConfirm).toContainText(/buzz|estimat/i);
    await animateOverlay.getByTestId('post-gen-confirm-animate-go').click();

    // Assert the animate child card container is visible.
    await expect(page.getByTestId('post-gen-child-animate').first()).toBeVisible({
      timeout: 60_000,
    });

    // The mocked videoGen blob URL is a fake `.mp4` — the browser may not
    // actually play it, but the <video> element must mount with controls +
    // the right src. Assert on the DOM, not on playback.
    const videoEl = page.getByTestId('post-gen-video').first();
    await expect(videoEl).toHaveAttribute('controls', '');
    const src = await videoEl.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/\.mp4$/);
  });
});
