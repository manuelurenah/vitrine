import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Ads list + wizard', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('list page renders heading', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/ads`);
    await expect(page.getByRole('heading', { name: /ads\./i })).toBeVisible();
  });

  test('new wizard renders the brief step with recommended sizes preselected', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/ads/new`);

    // The wizard opens on the brief step (no LLM draft pass).
    await expect(page.getByTestId('ad-brief-step')).toBeVisible();
    await expect(page.getByTestId('ad-title')).toBeVisible();
    await expect(page.getByTestId('ad-description')).toBeVisible();

    // The size picker defaults to recommendedAdSizeIds() → at least one option
    // is pressed on initial render.
    const pressedSizes = page.locator('button[data-size-id][aria-pressed="true"]');
    await expect(pressedSizes.first()).toBeVisible();
    expect(await pressedSizes.count()).toBeGreaterThan(0);
  });

  test('brief → review → cook → /ads/[id] with creatives that finish cooking', async ({
    page,
    baseURL,
  }) => {
    // Cook fans out one workflow per selected size; the polling window needs
    // room for the MSW pending → processing → succeeded progression per tile.
    test.setTimeout(180_000);

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/ads/new`);

    await expect(page.getByTestId('ad-brief-step')).toBeVisible();

    // Title + description are required — the wizard composes the prompt from
    // them. Fill both so the cook payload validates.
    await page.getByTestId('ad-title').fill('spring launch — citrus drop');
    await page
      .getByTestId('ad-description')
      .fill('a bright bottle on a sunlit table, warm tones, bold product hero');

    // The picker defaults to recommendedAdSizeIds(). Trim the selection down to
    // a single size so the cook fans out the smallest deterministic set, then
    // assert at least one size remains selected before continuing.
    const pressedSizes = page.locator('button[data-size-id][aria-pressed="true"]');
    await expect(pressedSizes.first()).toBeVisible();
    // Snapshot the selected size ids up-front — the pressed locator is live, so
    // clicking to deselect shrinks the match set and index-based access goes
    // stale. Address each button by its stable data-size-id instead. A given
    // size id can appear under multiple format groups (shared sizes), so a
    // first()-scoped click toggles every instance via the shared `selected` set.
    const pressedIds = await pressedSizes.evaluateAll((els) =>
      Array.from(new Set(els.map((el) => el.getAttribute('data-size-id')!))),
    );
    expect(pressedIds.length).toBeGreaterThan(0);
    const keepId = pressedIds[0]!;
    for (const id of pressedIds.slice(1)) {
      await page.locator(`button[data-size-id="${id}"]`).first().click();
    }
    // Exactly one logical size remains selected (counted by distinct id).
    await expect(page.locator(`button[data-size-id="${keepId}"][aria-pressed="true"]`).first()).toBeVisible();
    const remainingIds = await pressedSizes.evaluateAll((els) =>
      Array.from(new Set(els.map((el) => el.getAttribute('data-size-id')!))),
    );
    expect(remainingIds).toEqual([keepId]);

    // brief → review.
    await page.getByTestId('ad-brief-continue').click();
    await expect(page.getByTestId('ad-review-step')).toBeVisible();

    // The review step fires the Buzz estimate. It degrades gracefully on
    // failure, so don't block on the total — just cook.
    await page.getByTestId('ad-cook').click();

    // Redirect into the detail page at /ads/<uuid>.
    await page.waitForURL(/\/ads\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Each creative card starts cooking (placeholder + status overlay) and
    // resolves to a rendered image once its workflow succeeds. Wait for the
    // first creative's image to appear.
    const creatives = page.locator('article');
    await expect(creatives.first()).toBeVisible();
    await expect(creatives.first().locator('img').first()).toBeVisible({ timeout: 60_000 });

    // Once done, the card flips its status badge to "ready".
    await expect(creatives.first().getByText('ready', { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    // Export/download affordances.
    //
    // Per-creative download link: rendered client-side as soon as the card's
    // poll flips it to `done`, so it's available without a server round-trip.
    const downloadLink = creatives.first().getByRole('link', { name: /download .* png/i });
    await expect(downloadLink).toHaveAttribute(
      'href',
      /\/api\/ads\/[\w-]+\/tiles\/[\w-]+\/download$/,
    );

    // Campaign-wide "export zip" button: its enabled state is derived
    // server-side from each tile's persisted `done` status (doneCount > 0). The
    // workflow long-poll route persists that terminal status, but the detail RSC
    // only reflects it on the next server render — so reload to pick up the
    // settled state, then assert the export affordance is live.
    const exportBtn = page.getByRole('button', { name: /export zip/i });
    await expect(exportBtn).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /export zip/i })).toBeEnabled({
      timeout: 30_000,
    });
  });
});
