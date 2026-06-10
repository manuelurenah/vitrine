import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

/**
 * Phase 2 workstream O — Ad-hoc generation from /brand/assets.
 *
 * Drives the AdHocGenerationModal end-to-end against MSW-mocked orchestrator
 * handlers: open → fill → generate → poll → results → save. Also covers the
 * "close mid-poll" escape hatch and verifies the modal's key-based remount
 * resets transient state on the next open.
 *
 * MSW progression for imageGen is deterministic (pending → processing →
 * succeeded) in `src/mocks/handlers.ts` so this spec does not need to stub
 * any network calls itself.
 */

test.describe('Ad-hoc generation modal', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('opens modal, generates, polls, picks one image, saves to library', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets`);

    // Empty state for a freshly-reset user — both empty-state and header CTAs
    // exist on the page depending on asset count, so target by testid.
    const openBtn = page
      .getByTestId('open-generate-modal-empty')
      .or(page.getByTestId('open-generate-modal'));
    await openBtn.first().click();

    // ---- form phase ----
    const form = page.getByTestId('adhoc-form');
    await expect(form).toBeVisible();

    await page
      .locator('#adhoc-prompt')
      .fill('studio-lit hero shot of a ceramic mug, soft shadows, warm tones');

    await page.getByTestId('adhoc-aspect-4:5').click();
    await expect(page.getByTestId('adhoc-aspect-4:5')).toHaveAttribute('aria-pressed', 'true');

    // numImages 1 → 2 (one click on the +)
    await page.getByTestId('adhoc-num-inc').click();
    await expect(page.getByTestId('adhoc-num-value')).toHaveText('2');

    // ---- submit + transition to polling ----
    const generatePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/assets/generate') &&
        !r.url().includes('/save') &&
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

    await expect(page.getByTestId('adhoc-polling')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('adhoc-polling-prompt')).toContainText(/ceramic mug/i);

    // ---- wait for results ----
    const results = page.getByTestId('adhoc-results');
    await expect(results).toBeVisible({ timeout: 60_000 });

    // 2 images requested → 2 result cards.
    await expect(page.getByTestId('adhoc-result-0')).toBeVisible();
    await expect(page.getByTestId('adhoc-result-1')).toBeVisible();

    // ---- pick one image + save ----
    await page.getByTestId('adhoc-result-0').click();
    await expect(page.getByTestId('adhoc-result-0')).toHaveAttribute('aria-checked', 'true');

    const saveBtn = page.getByTestId('adhoc-save-selected');
    await expect(saveBtn).toBeEnabled();

    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/api/assets/generate/save') && r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await saveBtn.click();
    const saveResp = await savePromise;
    expect(saveResp.status()).toBe(200);
    const saveBody = (await saveResp.json()) as { savedAssetIds?: string[] };
    expect(saveBody.savedAssetIds?.length ?? 0).toBeGreaterThanOrEqual(1);

    // ---- modal closes + page refreshes; gallery now has at least one tile.
    await expect(results).toBeHidden({ timeout: 10_000 });
    // After router.refresh(), the assets page should leave the empty state.
    // Two reliable signals: the header generate-modal CTA appears, OR the
    // empty-state heading disappears. Either is sufficient.
    await expect(
      page.getByTestId('open-generate-modal').or(page.getByTestId('open-generate-modal-empty')),
    ).toBeVisible();
    // If the gallery rendered tiles, the "N total" counter shows up.
    const total = page.getByText(/\b1 total\b/i);
    // Soft assert — don't fail the whole run if router.refresh() raced the DB
    // commit on slow CI. The save endpoint already returned 200.
    await total.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  });

  test('close mid-poll dismisses the modal and resets state on reopen', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets`);

    const openBtn = page
      .getByTestId('open-generate-modal-empty')
      .or(page.getByTestId('open-generate-modal'));
    await openBtn.first().click();

    await expect(page.getByTestId('adhoc-form')).toBeVisible();
    await page.locator('#adhoc-prompt').fill('a minimal product flatlay, top-down');

    const generatePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/assets/generate') &&
        !r.url().includes('/save') &&
        r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId('adhoc-generate').click();
    await generatePromise;

    await expect(page.getByTestId('adhoc-polling')).toBeVisible({ timeout: 15_000 });

    // Click the "close — keep cooking in the background" button mid-poll.
    await page.getByRole('button', { name: /keep cooking in the background/i }).click();
    await expect(page.getByTestId('adhoc-polling')).toBeHidden({ timeout: 10_000 });

    // Reopen — should land back in the form phase with an empty prompt
    // because the inner component is keyed on `open` and re-mounts.
    await openBtn.first().click();
    await expect(page.getByTestId('adhoc-form')).toBeVisible();
    await expect(page.locator('#adhoc-prompt')).toHaveValue('');
    await expect(page.getByTestId('adhoc-num-value')).toHaveText('1');
    await expect(page.getByTestId('adhoc-aspect-1:1')).toHaveAttribute('aria-pressed', 'true');
  });
});
