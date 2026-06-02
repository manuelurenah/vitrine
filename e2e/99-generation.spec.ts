import { expect, test } from './fixtures';
import { markOnboardingComplete, resetUserData } from './helpers/db';
import { signInToApp } from './helpers/auth';

/**
 * Smoke pass over the full generation pipeline against deterministic MSW
 * mocks: preview → cook → poll → upscale → animate.
 *
 * This spec is the regression net for the imageGen workstream — if any step
 * in the cook flow regresses (preview cost surfacing, cook payload shape,
 * polling progression, or post-gen action wiring) this is the first thing
 * to fail.
 */

test.describe('Generation pipeline smoke', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('preview → cook → poll → upscale → animate', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await signInToApp(page, baseURL!);

    // ----- preview: hit /api/campaigns/preview via the wizard's continue btn
    await page.goto(`${baseURL}/campaigns/new`);
    await expect(page.getByTestId('brief-step')).toBeVisible();

    // Capture the preview network call so we can assert the cost number is
    // > 0 (MSW returns deterministic 60 × numImages for whatif=true).
    const previewResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/campaigns/preview') && r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId('brief-continue').click();
    const previewResp = await previewResponsePromise;
    expect(previewResp.status()).toBe(200);
    const previewBody = (await previewResp.json()) as { totalBuzz?: number };
    expect(previewBody.totalBuzz ?? 0).toBeGreaterThan(0);

    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('total-buzz')).toBeVisible();

    // ----- cook: hit /api/campaigns/cook + redirect to detail page
    const cookResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/campaigns/cook') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByTestId('review-cook').click();
    const cookResp = await cookResponsePromise;
    expect(cookResp.status()).toBe(200);
    const cookBody = (await cookResp.json()) as { campaignId?: string };
    expect(cookBody.campaignId).toBeTruthy();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });

    // ----- poll: detail page long-polls /api/workflow/[id]; image appears
    // after MSW progression reaches Succeeded.
    const firstImage = page.locator('[data-image-overlay] img').first();
    await expect(firstImage).toBeVisible({ timeout: 30_000 });

    // ----- upscale: hover the first image and confirm the post-gen action
    const overlays = page.locator('[data-image-overlay]');
    const upscaleOverlay = overlays.first();
    await upscaleOverlay.hover();
    await upscaleOverlay.getByTestId('post-gen-chip-upscale-2-').click();
    await upscaleOverlay.getByTestId('post-gen-confirm-upscale-go').click();
    await expect(upscaleOverlay.getByTestId('post-gen-upscaled')).toBeVisible({
      timeout: 60_000,
    });

    // ----- animate: pick a separate overlay if available so the upscale
    // child card doesn't obstruct the animate chips. Falls back to the same
    // overlay if only one image rendered.
    const overlayCount = await overlays.count();
    const animateOverlay = overlayCount > 1 ? overlays.nth(1) : upscaleOverlay;
    await animateOverlay.hover();
    await animateOverlay.getByTestId('post-gen-chip-animate').click();
    await animateOverlay.getByTestId('post-gen-confirm-animate-go').click();
    const videoEl = animateOverlay.getByTestId('post-gen-video');
    await expect(videoEl).toBeVisible({ timeout: 60_000 });
    await expect(videoEl).toHaveAttribute('controls', '');
  });
});
