import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Photoshoot list + wizard', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot`);
    await expect(page.getByRole('heading', { name: /photoshoot\./i })).toBeVisible();
  });

  test('new wizard renders the brief step', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/new`);
    await expect(page.getByTestId('photoshoot-wizard')).toBeVisible();
    await expect(page.getByTestId('brief-step')).toBeVisible();
    // The sticky action bar's submit button says "generate" (the brief step
    // calls fetchPreview + goStep('review') on submit). No "preview & review" label.
    await expect(page.getByRole('button', { name: /^generate/i })).toBeVisible();
  });

  test('brief → review → cook → /photoshoot/[id] with populated tiles', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/new`);

    // Defaults: templates from defaultOn are pre-selected; variants=1; ratio=4:5.
    // Click "generate" — fires POST /api/photoshoot/preview and advances to review.
    await page.getByRole('button', { name: /^generate/i }).click();

    // Step 2: review — enhanced prompt + brand layer + cook button.
    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('total-buzz')).toBeVisible();

    const templateCards = page.locator('[data-testid="template-card"]');
    await expect(templateCards.first()).toBeVisible();
    const firstTemplateId = await templateCards.first().getAttribute('data-template-id');
    expect(firstTemplateId).toBeTruthy();

    // Open brand-layer disclosure on the first template card to verify the
    // prompt layer breakdown surfaces in the review UI. The "style" layer is
    // always present (sourced from template.styleNotes); brand layer is only
    // non-empty when brand DNA is configured.
    await templateCards.first().getByTestId('brand-toggle').click();
    await expect(templateCards.first().getByText(/^style$/i)).toBeVisible();

    // Override the raw prompt — debounced re-preview happens server-side.
    await templateCards.first().getByTestId('edit-toggle').click();
    const override = page.getByTestId(`override-textarea-${firstTemplateId}`);
    await expect(override).toBeVisible();
    await override.fill('hand-tuned photoshoot override — e2e test');

    // Cook for X buzz → POST /api/photoshoot/cook → redirect.
    await page.getByTestId('cook-button').click();
    await page.waitForURL(/\/photoshoot\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Tiles populate after the MSW polling progression completes.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });
});
