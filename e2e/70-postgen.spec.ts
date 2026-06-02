import { expect, test } from './fixtures';
import { markOnboardingComplete, resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

/**
 * Post-generation actions — upscale + animate. Starts from a fresh campaign
 * cook, waits for the first tile to land an image, then exercises the
 * hover-overlay → confirm → child-card polling flow for both actions.
 *
 * The MSW handlers in `src/mocks/handlers.ts` ship distinct response shapes
 * per step type:
 *   - imageUpscaler → single `images[0].url` on succeeded snapshot
 *   - videoGen      → `images[0]` poster + `blobs[0]` with mimeType `video/mp4`
 */

test.describe('Post-generation actions (upscale + animate)', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('upscale + animate from a completed campaign tile', async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await signInToApp(page, baseURL!);

    // ----- cook a campaign -----
    await page.goto(`${baseURL}/campaigns/new`);
    await page.getByTestId('brief-continue').click();
    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('review-cook').click();
    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });

    // ----- wait for the first generated image to render -----
    const firstImage = page.locator('[data-image-overlay] img').first();
    await expect(firstImage).toBeVisible({ timeout: 30_000 });

    // ----- hover overlay reveals the post-gen action chips -----
    const overlay = page.locator('[data-image-overlay]').first();
    await overlay.hover();

    const upscaleChip = overlay.getByTestId('post-gen-chip-upscale-2-');
    await expect(upscaleChip).toBeVisible();
    // Buzz cost preview is rendered as part of the chip — "buzz" suffix or
    // "estimate…" prelude.
    await expect(upscaleChip).toContainText(/buzz|estimat/i);

    // ----- upscale flow -----
    await upscaleChip.click();
    const upscaleConfirm = overlay.getByTestId('post-gen-confirm-upscale');
    await expect(upscaleConfirm).toBeVisible();
    // Cost preview surfaces inside the confirm panel.
    await expect(upscaleConfirm).toContainText(/buzz|estimat/i);
    await overlay.getByTestId('post-gen-confirm-upscale-go').click();

    // Child card appears + polls; eventually swaps the skeleton for an image.
    const upscaleChild = overlay.getByTestId('post-gen-child-upscale');
    await expect(upscaleChild).toBeVisible({ timeout: 30_000 });
    await expect(upscaleChild.getByTestId('post-gen-upscaled')).toBeVisible({
      timeout: 60_000,
    });

    // ----- animate flow on a sibling image (or fall back to same image if
    // only 1 was rendered). Find a different overlay where the chip is still
    // enabled (not already used). -----
    const overlays = page.locator('[data-image-overlay]');
    const overlayCount = await overlays.count();
    let animateOverlay = overlays.nth(0);
    if (overlayCount > 1) {
      animateOverlay = overlays.nth(1);
    } else {
      // Only one image — close the previous interaction by moving the mouse
      // away first, then re-hover. The upscale child card sits over the
      // bottom; the animate chip should still be reachable via hover.
      await page.mouse.move(0, 0);
    }
    await animateOverlay.hover();
    const animateChip = animateOverlay.getByTestId('post-gen-chip-animate');
    await expect(animateChip).toBeVisible();
    await expect(animateChip).toContainText(/buzz|estimat/i);
    await animateChip.click();
    const animateConfirm = animateOverlay.getByTestId('post-gen-confirm-animate');
    await expect(animateConfirm).toBeVisible();
    await expect(animateConfirm).toContainText(/buzz|estimat/i);
    await animateOverlay.getByTestId('post-gen-confirm-animate-go').click();

    const animateChild = animateOverlay.getByTestId('post-gen-child-animate');
    await expect(animateChild).toBeVisible({ timeout: 30_000 });

    // The mocked videoGen blob URL is a fake `.mp4` — the browser may not
    // actually play it, but the <video> element must mount with controls +
    // the right src. Assert on the DOM, not on playback.
    const videoEl = animateChild.getByTestId('post-gen-video');
    await expect(videoEl).toBeVisible({ timeout: 60_000 });
    await expect(videoEl).toHaveAttribute('controls', '');
    const src = await videoEl.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/\.mp4$/);
  });
});
