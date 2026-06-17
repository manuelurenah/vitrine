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

  test('preview → cook → poll → tiles render', async ({ page, baseURL }) => {
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

    // ----- poll: the detail page long-polls /api/workflow/[id]; the cooked
    // image lands in the row view once MSW progression reaches Succeeded.
    //
    // Inline upscale/animate post-gen actions were removed in the
    // row-per-variant refactor (dfb7879) — the row view surfaces
    // edit/download/regenerate only (covered by 52/53 specs), so this smoke
    // stops at "the cooked tile renders an image".
    const firstImage = page.locator('[data-testid="campaign-creative-row"] img').first();
    await expect(firstImage).toBeVisible({ timeout: 30_000 });
  });
});
