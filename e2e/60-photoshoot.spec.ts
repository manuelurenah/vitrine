import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

const COMPOSER_PLACEHOLDER = /describe the photoshoot you want/i;

test.describe('Photoshoot compose → configure → review → cook', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot`);
    await expect(page.getByRole('heading', { name: /photoshoot\./i })).toBeVisible();
  });

  test('composer on the grid pushes to /photoshoot/new with the prompt', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot`);

    // The shared PromptComposer drives the grid. Type a prompt and submit.
    await page.getByPlaceholder(COMPOSER_PLACEHOLDER).fill('amber serum on a warm wooden counter');
    await page.getByRole('button', { name: /design shoot/i }).click();

    // It pushes to /photoshoot/new?prompt=… and the wizard mounts on configure.
    await page.waitForURL(/\/photoshoot\/new\?prompt=/, { timeout: 10_000 });
    await expect(page.getByTestId('photoshoot-wizard')).toBeVisible();
    await expect(page.getByTestId('configure-step')).toBeVisible({ timeout: 15_000 });
  });

  test('compose → configure (draft prefill) → review → cook → /photoshoot/[id]', async ({
    page,
    baseURL,
  }) => {
    // The draft step is mocked (MSW OpenRouter */chat/completions), but allow a
    // generous budget for the preview estimate round-trips on top.
    test.setTimeout(120_000);

    await signInToApp(page, baseURL!);

    // 1) Land on the wizard as the composer push would (covered separately in
    // "composer on the grid pushes to /photoshoot/new"). Navigating directly to
    // the prompt deep-link is the exact state a user is in after that push and
    // keeps the draft fetch deterministic for the rest of the flow.
    await page.goto(
      `${baseURL}/photoshoot/new?prompt=${encodeURIComponent('amber serum on a warm wooden counter')}`,
    );

    // 2) Configure — the wizard auto-calls POST /api/photoshoot/draft on mount
    // (mocked) and prefills the master prompt + recommended styles. Wait for the
    // mocked draft prompt to land so we know prefill completed.
    await expect(page.getByTestId('configure-step')).toBeVisible({ timeout: 15_000 });
    const promptField = page.getByTestId('photoshoot-prompt');
    await expect(promptField).not.toHaveValue('', { timeout: 20_000 });

    // Set a free-text photoshoot name.
    const nameField = page.getByTestId('photoshoot-name');
    await nameField.fill('golden hour serum set');

    // The draft seeds at least one style chip as selected (data-active is set on
    // active chips). Guard that at least one is active before continuing.
    const activeChips = page.locator('[data-testid="style-chip"][data-active]');
    await expect(activeChips.first()).toBeVisible({ timeout: 10_000 });
    const selectedCount = await activeChips.count();
    expect(selectedCount).toBeGreaterThan(0);

    // Ratio chips include 16:9 — assert it exists and is selectable.
    const ratio169 = page.getByRole('radio', { name: '16:9' });
    await expect(ratio169).toBeVisible();
    await ratio169.click();
    await expect(ratio169).toHaveAttribute('aria-checked', 'true');

    // Continue is enabled once the prompt is non-empty + a style is selected.
    const cont = page.getByTestId('configure-continue');
    await expect(cont).toBeEnabled({ timeout: 20_000 });
    await cont.click();

    // 3) Review — one template-card per selected style.
    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('total-buzz')).toBeVisible();
    const cards = page.locator('[data-testid="template-card"]');
    await expect(cards).toHaveCount(selectedCount, { timeout: 20_000 });

    const firstCard = cards.first();
    const firstTemplateId = await firstCard.getAttribute('data-template-id');
    expect(firstTemplateId).toBeTruthy();

    // Brand-layer disclosure surfaces the prompt layer breakdown.
    await firstCard.getByTestId('brand-toggle').click();
    await expect(firstCard.getByText(/^style$/i)).toBeVisible();

    // The final-prompt textarea is always editable (no edit toggle).
    const override = page.getByTestId(`override-textarea-${firstTemplateId}`);
    await expect(override).toBeVisible();
    await override.fill('hand-tuned photoshoot override — e2e test');

    // 4) Cook → POST /api/photoshoot/cook → redirect to /photoshoot/<id>.
    await page.getByTestId('cook-button').click();
    await page.waitForURL(/\/photoshoot\/[\w-]+$/, { timeout: 30_000 });

    // Detail page renders campaign-style rows (one per cooked tile/style).
    const rows = page.getByTestId('pshoot-result-row');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    expect(await rows.count()).toBe(selectedCount);
  });

  test('two same-group styles render two separate review cards', async ({ page, baseURL }) => {
    // Guards the original bug where multiple styles from the same group
    // (e.g. studio·clean + studio·moody, both group "studio") collapsed into a
    // single review card. The unit test can't catch the rendered card count.
    test.setTimeout(120_000);

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/photoshoot/new?prompt=${encodeURIComponent('a studio set')}`);

    await expect(page.getByTestId('configure-step')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('photoshoot-prompt')).not.toHaveValue('', { timeout: 20_000 });

    // Deselect everything the draft pre-selected, then select exactly the two
    // studio-group chips by their data-template-id.
    const activeChips = page.locator('[data-testid="style-chip"][data-active]');
    const activeCount = await activeChips.count();
    for (let i = 0; i < activeCount; i++) {
      // Re-query each time: clicking flips data-active off, shrinking the set.
      await page.locator('[data-testid="style-chip"][data-active]').first().click();
    }
    await expect(page.locator('[data-testid="style-chip"][data-active]')).toHaveCount(0);

    const studioClean = page.locator('[data-testid="style-chip"][data-template-id="studio-clean"]');
    const studioMoody = page.locator('[data-testid="style-chip"][data-template-id="studio-dark"]');
    await studioClean.click();
    await studioMoody.click();
    await expect(page.locator('[data-testid="style-chip"][data-active]')).toHaveCount(2);

    const cont = page.getByTestId('configure-continue');
    await expect(cont).toBeEnabled({ timeout: 20_000 });
    await cont.click();

    // Two distinct template cards — NOT collapsed into one studio card.
    await expect(page.getByTestId('review-step')).toBeVisible({ timeout: 20_000 });
    const cards = page.locator('[data-testid="template-card"]');
    await expect(cards).toHaveCount(2, { timeout: 20_000 });
    const ids = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-template-id')),
    );
    expect(new Set(ids)).toEqual(new Set(['studio-clean', 'studio-dark']));
  });
});
