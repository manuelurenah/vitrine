import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

/**
 * Smoke pass over the full generation pipeline against deterministic MSW
 * mocks: prompt → draft → brief (preview) → cook → poll → upscale → animate.
 *
 * This spec is the regression net for the imageGen workstream — if any step
 * in the cook flow regresses (preview cost surfacing, cook payload shape,
 * polling progression, or post-gen action wiring) this is the first thing
 * to fail.
 *
 * Wizard flow (CampaignWizard):
 *   prompt step  →  [draft brief]  →  brief step  →  [cook]  →  submit step  →  /campaigns/[id]
 *   testids:  prompt-step / prompt-continue         brief-step / brief-cook
 */

test.describe('Generation pipeline smoke', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('preview → cook → poll → upscale → animate', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await signInToApp(page, baseURL!);

    // ----- prompt step: fill prompt, click "draft brief"
    await page.goto(`${baseURL}/campaigns/new`);
    await expect(page.getByTestId('prompt-step')).toBeVisible();

    await page
      .getByTestId('prompt-input')
      .fill('chili oil summer launch — warm tones, bold copy, festival energy');

    // Set up the preview response interceptor before clicking prompt-continue
    // so we don't miss the POST /api/campaigns/preview that auto-fires when
    // the brief step mounts (the brief-step useEffect calls schedule()).
    const previewResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/campaigns/preview') && r.request().method() === 'POST',
      { timeout: 90_000 },
    );

    // Click "draft brief" — fires POST /api/campaigns/draft (real server route).
    // The LLM chain may fall back across models (up to ~30s), then navigates
    // to ?step=brief which triggers the preview useEffect.
    await page.getByTestId('prompt-continue').click();

    // ----- brief step: wait for the step + verify preview cost > 0
    // (MSW returns 60 × numImages for the whatif workflow estimate).
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });

    const previewResp = await previewResponsePromise;
    expect(previewResp.status()).toBe(200);
    const previewBody = (await previewResp.json()) as { totalBuzz?: number };
    expect(previewBody.totalBuzz ?? 0).toBeGreaterThan(0);

    await expect(page.getByTestId('total-buzz')).toBeVisible();

    // ----- cook: hit /api/campaigns/cook + redirect to detail page
    const cookResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/campaigns/cook') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByTestId('brief-cook').click();
    const cookResp = await cookResponsePromise;
    expect(cookResp.status()).toBe(200);
    const cookBody = (await cookResp.json()) as { campaignId?: string };
    expect(cookBody.campaignId).toBeTruthy();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });

    // ----- poll: detail page long-polls /api/workflow/[id]; image appears
    // after MSW progression reaches Succeeded.
    const firstImage = page.locator('[data-image-overlay] img').first();
    await expect(firstImage).toBeVisible({ timeout: 30_000 });

    // ----- upscale: open the actions menu (hamburger MoreHorizontal button,
    // aria-label="image actions") then click the upscale chip. The chips live
    // in a dropdown that is hidden until the menu button is clicked — hover
    // alone does not reveal them.
    const overlays = page.locator('[data-image-overlay]');
    const upscaleOverlay = overlays.first();
    await upscaleOverlay.getByRole('button', { name: /image actions/i }).click();
    await upscaleOverlay.getByTestId('post-gen-chip-upscale-2-').click();
    await upscaleOverlay.getByTestId('post-gen-confirm-upscale-go').click();
    // post-gen-upscaled img lives inside the image overlay absolute container.
    // The child card is absolutely positioned; check the container card instead
    // to avoid overflow-clipping false-negatives from the ImageSlot's
    // overflow:hidden parent.
    await expect(page.getByTestId('post-gen-child-upscale').first()).toBeVisible({
      timeout: 60_000,
    });

    // ----- animate: pick a separate overlay if available so the upscale
    // child card doesn't obstruct the animate chips. Falls back to the same
    // overlay if only one image rendered.
    const overlayCount = await overlays.count();
    const animateOverlay = overlayCount > 1 ? overlays.nth(1) : upscaleOverlay;
    await animateOverlay.getByRole('button', { name: /image actions/i }).click();
    await animateOverlay.getByTestId('post-gen-chip-animate').click();
    await animateOverlay.getByTestId('post-gen-confirm-animate-go').click();
    // Check the animate child card container, then the video element inside it.
    await expect(page.getByTestId('post-gen-child-animate').first()).toBeVisible({
      timeout: 60_000,
    });
    const videoEl = page.getByTestId('post-gen-video').first();
    await expect(videoEl).toHaveAttribute('controls', '');
  });
});
