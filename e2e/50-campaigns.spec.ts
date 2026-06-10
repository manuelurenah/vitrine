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

  test('new wizard renders the brief step by default', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // Default landing is ?step=brief — controlled in the wizard.
    await expect(page.getByTestId('brief-step')).toBeVisible();
    await expect(page.getByLabel(/campaign title/i)).toBeVisible();
    await expect(page.getByLabel(/^description$/i)).toBeVisible();
    await expect(page.getByTestId('brief-continue')).toBeVisible();
  });

  test('brief → review → cook → /campaigns/[id] with skeletons & populated tiles', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // Step 1: brief — BriefStep ships sensible defaults (title, description,
    // presetIds). We bump variants from 1 → 2 to verify the stepper + multi
    // image rendering.
    const stepper = page.getByTestId('variants-stepper');
    await expect(stepper).toBeVisible();
    const initialVariants = await page.getByTestId('variants-value').textContent();
    await stepper.getByRole('button', { name: /increment variants/i }).click();
    await expect(page.getByTestId('variants-value')).not.toHaveText(initialVariants ?? '1');

    // Picker is present (products tab is default). We do NOT require a
    // product to exist — leaving refs empty still exercises the imageGen path.
    await expect(page.getByTestId('asset-catalog-picker')).toBeVisible();

    // Continue to review — fires POST /api/campaigns/preview against the
    // MSW-mocked orchestrator.
    await page.getByTestId('brief-continue').click();

    // Step 2: review — wait for the preview step + total buzz pill, then
    // verify at least one preset card surfaces the enhanced prompt.
    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('total-buzz')).toBeVisible();
    const presetCards = page.locator('[data-testid^="preset-card-"]');
    await expect(presetCards.first()).toBeVisible();
    const firstPresetId = await presetCards.first().getAttribute('data-preset-id');
    expect(firstPresetId).toBeTruthy();

    // Verify enhanced prompt + brand layer disclosure on the first preset.
    await expect(page.getByTestId(`final-prompt-${firstPresetId}`)).toBeVisible();
    await page.getByTestId(`toggle-brand-${firstPresetId}`).click();
    await expect(page.getByTestId(`brand-layer-${firstPresetId}`)).toBeVisible();

    // Override the raw prompt on the first preset → debounced re-preview.
    await page.getByTestId(`toggle-edit-${firstPresetId}`).click();
    const override = page.getByTestId(`override-input-${firstPresetId}`);
    await expect(override).toBeVisible();
    await override.fill('hand-tuned override prompt for e2e — chili oil, dramatic light');

    // Submit. The cook button text encodes the total buzz dynamically, so we
    // match by test id (not the label).
    await page.getByTestId('review-cook').click();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Skeletons render before the first poll resolves (MSW progression goes
    // Pending → Processing → Succeeded). Real images render after.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });
});
