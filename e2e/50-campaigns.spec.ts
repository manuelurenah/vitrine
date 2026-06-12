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

  test('new wizard renders the prompt entry by default (no incoming prompt)', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // No ?prompt= → the slimmed prompt entry (prompt + references + generate).
    await expect(page.getByTestId('prompt-step')).toBeVisible();
    await expect(page.getByTestId('prompt-input')).toBeVisible();
    await expect(page.getByTestId('prompt-continue')).toBeVisible();
    // Format picker + variants now live on the review step, not here.
    await expect(page.getByTestId('variants-stepper')).toHaveCount(0);
  });

  test('auto-draft → brief → cook → /campaigns/[id] with skeletons & populated tiles', async ({
    page,
    baseURL,
  }) => {
    // Generous timeout: POST /api/campaigns/draft calls an LLM chain that can
    // take up to ~30s when it has to retry across models / JSON-mode fallback.
    test.setTimeout(180_000);

    await signInToApp(page, baseURL!);

    // Arrive WITH a prompt (mirrors the composer). The wizard auto-fires the
    // draft on mount and lands on the brief step — no manual "draft brief" click.
    const prompt = 'summer chili-oil product launch — warm tones, bold copy';
    await page.goto(`${baseURL}/campaigns/new?prompt=${encodeURIComponent(prompt)}`);

    // The drafting overlay renders from the first paint (auto-draft is decided
    // during render, not in an effect), so it's up well before the LLM returns.
    await expect(page.getByTestId('drafting-overlay')).toBeVisible();

    // ...then the brief step appears once the draft lands. 60s covers
    // multi-model fallback.
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });

    // Variants stepper now lives on the brief step. It starts at 1; bump to 2.
    const stepper = page.getByTestId('variants-stepper');
    await expect(stepper).toBeVisible();
    await expect(page.getByTestId('variants-value')).toHaveText('1');
    await stepper.getByRole('button', { name: 'increment variants' }).click();
    await expect(page.getByTestId('variants-value')).toHaveText('2');

    // Ad-copy cards for each preset are always rendered on the brief step.
    const adCopyCards = page.locator('[data-testid^="adcopy-card-"]');
    await expect(adCopyCards.first()).toBeVisible();
    const firstPresetId = await adCopyCards.first().getAttribute('data-preset-id');
    expect(firstPresetId).toBeTruthy();

    // Expand advanced — gated on showAdvanced && preview. Wait for total-buzz
    // to confirm the preview returned before clicking.
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

    // Cook. Button text encodes the total buzz dynamically — match by test id.
    await page.getByTestId('brief-cook').click();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Skeletons render before the first poll resolves (MSW pending → processing
    // → succeeded). Real images render after.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });
});
