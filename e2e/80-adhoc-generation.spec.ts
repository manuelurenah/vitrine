import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

/**
 * Phase 2 workstream O — Ad-hoc generation from /assets.
 *
 * The modal flow was reworked: there is no in-modal polling/results/selection
 * step anymore. The flow is now:
 *   open modal → fill prompt → generate → modal CLOSES immediately → a
 *   placeholder "cooking" card (CookingAssetCard) appears in the /assets grid →
 *   it long-polls /api/workflow/{id} until terminal → the workflow route
 *   auto-persists the result as an asset → router.refresh() surfaces it in the
 *   grid (no separate "save selected" step).
 *
 * MSW progression for imageGen is deterministic (pending → processing →
 * succeeded) in `src/mocks/handlers.ts` so this spec does not need to stub any
 * network calls itself.
 */

test.describe('Ad-hoc generation modal', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('opens modal, generates, modal closes, cooking card lands as an asset', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/assets`);

    // Empty state for a freshly-reset user — both empty-state and header CTAs
    // exist on the page depending on asset count, so target by testid.
    const openBtn = page
      .getByTestId('open-generate-modal-empty')
      .or(page.getByTestId('open-generate-modal'));
    await openBtn.first().click();

    // ---- form phase ----
    const form = page.getByTestId('adhoc-form');
    await expect(form).toBeVisible();

    // The prompt autofocuses on open (FormView focuses the textarea on mount).
    await expect(page.locator('#adhoc-prompt')).toBeFocused();

    await page
      .locator('#adhoc-prompt')
      .fill('studio-lit hero shot of a ceramic mug, soft shadows, warm tones');

    await page.getByTestId('adhoc-aspect-4:5').click();
    await expect(page.getByTestId('adhoc-aspect-4:5')).toHaveAttribute('aria-pressed', 'true');

    // numImages 1 → 2 (one click on the +)
    await page.getByTestId('adhoc-num-inc').click();
    await expect(page.getByTestId('adhoc-num-value')).toHaveText('2');

    // ---- submit: POST /api/assets/generate, then the modal closes itself ----
    const generatePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/assets/generate') &&
        !r.url().includes('/estimate') &&
        r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId('adhoc-generate').click();
    const generateResp = await generatePromise;
    expect(generateResp.status()).toBe(200);
    const generateBody = (await generateResp.json()) as {
      workflowId?: string;
      estimatedBuzz?: number;
    };
    expect(generateBody.workflowId).toBeTruthy();
    expect(generateBody.estimatedBuzz).toBeGreaterThan(0);

    // Modal closes immediately on a successful submit — the form disappears.
    await expect(form).toBeHidden({ timeout: 10_000 });

    // A placeholder "cooking" card appears in the grid while the workflow runs.
    // It may resolve quickly against the MSW-mocked orchestrator, so don't fail
    // if it has already flipped to a real asset by the time we look — assert
    // either the cooking card OR the landed asset is present.
    const cookingCard = page.getByTestId('cooking-asset-card').first();
    const anyAssetTile = page.getByRole('link', { name: /^open / }).first();
    await expect(cookingCard.or(anyAssetTile)).toBeVisible({ timeout: 15_000 });

    // ---- results land as an asset ----
    // CookingAssetCard polls /api/workflow/{id} until terminal; the workflow
    // route auto-persists the result, then router.refresh() surfaces it. Wait
    // for the cooking card to disappear and a real asset tile to appear.
    await expect(cookingCard).toBeHidden({ timeout: 60_000 });
    await expect(anyAssetTile).toBeVisible({ timeout: 60_000 });

    // The page should have left the pure empty state — the header generate CTA
    // (only rendered once assets exist) is a reliable signal.
    await expect(page.getByTestId('open-generate-modal')).toBeVisible({ timeout: 10_000 });
  });

  test('cancel closes the modal and the form resets on reopen', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/assets`);

    const openBtn = page
      .getByTestId('open-generate-modal-empty')
      .or(page.getByTestId('open-generate-modal'));
    await openBtn.first().click();

    await expect(page.getByTestId('adhoc-form')).toBeVisible();

    // Type into the form, then cancel without generating.
    await page.locator('#adhoc-prompt').fill('a minimal product flatlay, top-down');
    await page.getByTestId('adhoc-num-inc').click();
    await expect(page.getByTestId('adhoc-num-value')).toHaveText('2');

    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByTestId('adhoc-form')).toBeHidden({ timeout: 10_000 });

    // Reopen — the inner component is keyed on `open`, so it re-mounts with the
    // default form state: empty prompt, 1 image, 1:1 aspect ratio.
    await openBtn.first().click();
    await expect(page.getByTestId('adhoc-form')).toBeVisible();
    await expect(page.locator('#adhoc-prompt')).toHaveValue('');
    await expect(page.getByTestId('adhoc-num-value')).toHaveText('1');
    await expect(page.getByTestId('adhoc-aspect-1:1')).toHaveAttribute('aria-pressed', 'true');
  });
});
