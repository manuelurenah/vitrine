import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Campaigns list + wizard', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);
    await expect(page.getByRole('heading', { name: /campaigns\./i })).toBeVisible();
  });

  test('new wizard renders the prompt step by default', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // Default landing is the prompt step — parseStep returns 'prompt' for any
    // unrecognised or absent ?step= param. Confirmed by CampaignWizard.test.tsx:
    // "renders the prompt step by default".
    await expect(page.getByTestId('prompt-step')).toBeVisible();
    await expect(page.getByTestId('prompt-input')).toBeVisible();
    await expect(page.getByTestId('prompt-continue')).toBeVisible();
  });

  test('prompt → brief → cook → /campaigns/[id] with skeletons & populated tiles', async ({
    page,
    baseURL,
  }) => {
    // Generous timeout: POST /api/campaigns/draft calls an LLM chain that can
    // take up to ~30s when it has to retry across models / JSON-mode fallback.
    test.setTimeout(180_000);

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // Step 1: prompt — fill the prompt textarea, optionally bump variants.
    await expect(page.getByTestId('prompt-step')).toBeVisible();
    await page
      .getByTestId('prompt-input')
      .fill('summer chili-oil product launch — warm tones, bold copy');

    // Variants stepper is on the prompt step. Bump from 1 → 2.
    const stepper = page.getByTestId('variants-stepper');
    await expect(stepper).toBeVisible();
    const initialVariants = await page.getByTestId('variants-value').textContent();
    await stepper.getByRole('button', { name: /increment variants/i }).click();
    await expect(page.getByTestId('variants-value')).not.toHaveText(initialVariants ?? '1');

    // Click "draft brief" — fires POST /api/campaigns/draft (real server route
    // backed by the LLM chain in lib/adCopy.ts). The wizard shows a drafting
    // overlay, then transitions to the brief step on success. We give 60s here
    // because the LLM chain may fall back across multiple models.
    await page.getByTestId('prompt-continue').click();

    // Step 2: brief — wait for the brief step + verify key elements.
    // The draft fills brief fields; a buzz preview auto-schedules on entry.
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });

    // Ad-copy cards for each preset are always rendered on the brief step
    // (not gated on preview).
    const adCopyCards = page.locator('[data-testid^="adcopy-card-"]');
    await expect(adCopyCards.first()).toBeVisible();
    const firstPresetId = await adCopyCards.first().getAttribute('data-preset-id');
    expect(firstPresetId).toBeTruthy();

    // Expand advanced section — gated on showAdvanced && preview. Wait for
    // total-buzz to confirm the preview request returned before clicking.
    await expect(page.getByTestId('total-buzz')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('toggle-advanced').click();

    const presetCards = page.locator('[data-testid^="preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 15_000 });
    const firstAdvancedPresetId = await presetCards.first().getAttribute('data-preset-id');
    expect(firstAdvancedPresetId).toBeTruthy();

    // Verify enhanced prompt + brand layer disclosure on the first preset.
    await expect(page.getByTestId(`final-prompt-${firstAdvancedPresetId}`)).toBeVisible();
    await page.getByTestId(`toggle-brand-${firstAdvancedPresetId}`).click();
    await expect(page.getByTestId(`brand-layer-${firstAdvancedPresetId}`)).toBeVisible();

    // Override the raw prompt on the first preset → debounced re-preview.
    await page.getByTestId(`toggle-edit-${firstAdvancedPresetId}`).click();
    const override = page.getByTestId(`override-input-${firstAdvancedPresetId}`);
    await expect(override).toBeVisible();
    await override.fill('hand-tuned override prompt for e2e — chili oil, dramatic light');

    // Submit. The cook button text encodes the total buzz dynamically, so we
    // match by test id (not the label).
    await page.getByTestId('brief-cook').click();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Skeletons render before the first poll resolves (MSW progression goes
    // pending → processing → succeeded). Real images render after.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });
});
