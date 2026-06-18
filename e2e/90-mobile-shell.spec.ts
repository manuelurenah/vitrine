import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('mobile shell', () => {
  // Lock the whole describe to a 390×844 viewport (iPhone 14 form factor).
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders the mobile shell below the breakpoint', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    // Mobile tab bar must be present and visible.
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // Desktop sidebar must NOT be rendered at mobile width — AppShell's
    // ternary never mounts Shell (which contains Sidebar) when isMobile is
    // true, so the element is entirely absent from the DOM.
    await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);

    // FAB is gated to mobile by CampaignsList's own useMediaQuery check,
    // so it should be visible on the campaigns list page.
    await expect(page.getByTestId('fab')).toBeVisible();
  });

  test('tab bar navigates between sections', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    // Confirm we start on campaigns with the tab bar visible.
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // Tap the "shoot" tab → should navigate to /photoshoot.
    await page.getByTestId('mobile-tab-shoot').click();
    await page.waitForURL(/\/photoshoot$/, { timeout: 15_000 });
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // Tap the "brand" tab → should navigate to /brand.
    await page.getByTestId('mobile-tab-brand').click();
    await page.waitForURL(/\/brand(\/.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
  });

  test('Modal renders as a BottomSheet on mobile', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);

    // Navigate to /assets. After resetUserData there are no assets,
    // so AssetsGallery renders AssetsEmptyState which has the
    // data-testid="open-generate-modal-empty" button.
    await page.goto(`${baseURL}/assets`);

    // Open the generate modal via the empty-state CTA.
    const emptyStateCta = page.getByTestId('open-generate-modal-empty');
    await expect(emptyStateCta).toBeVisible({ timeout: 10_000 });
    await emptyStateCta.click();

    // On mobile the Modal component delegates to BottomSheet, so we expect
    // data-testid="bottom-sheet" to appear, not a centred dialog.
    await expect(page.getByTestId('bottom-sheet')).toBeVisible({ timeout: 10_000 });

    // No centred dialog role should be used at the top-level fixed container
    // (the desktop Modal renders role="dialog" inside a centered flex container;
    // BottomSheet renders role="dialog" at the bottom). Both have role=dialog
    // but only the bottom-sheet testid is present on mobile.
    // We verify the desktop-only path is NOT present by checking the
    // bottom-sheet testid suffices as the only dialog variant.
    const dialogs = page.locator('[role="dialog"]');
    await expect(dialogs).toHaveCount(1);

    // Dismiss via Escape — BottomSheet has its own keydown listener.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bottom-sheet')).toBeHidden({ timeout: 5_000 });
  });

  test('tab bar is pinned to the viewport bottom without scrolling', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    const bar = page.getByTestId('mobile-tab-bar');
    await expect(bar).toBeVisible();

    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    const viewportHeight = page.viewportSize()!.height; // 844

    // The bar's bottom edge must sit at the bottom of the viewport (tolerance
    // covers the floating inset + headless safe-area = 0). Before the h-dvh fix
    // the frame collapses to content height, so the absolute-positioned bar
    // floats above the bottom (short page) or below the viewport (tall page) —
    // either way this range fails.
    const barBottom = box!.y + box!.height;
    expect(barBottom).toBeGreaterThan(viewportHeight - 90);
    expect(barBottom).toBeLessThanOrEqual(viewportHeight + 1);

    // On-screen without scrolling.
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y).toBeLessThan(viewportHeight);
  });

  test('tab bar renders as a floating rounded pill with an active a11y marker', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    const bar = page.getByTestId('mobile-tab-bar');
    await expect(bar).toBeVisible();

    // Pill shape: 28px corner radius (was 0 on the old edge-to-edge bar).
    const radius = await bar.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('28px');

    // Floating: inset from both screen edges.
    const box = await bar.boundingBox();
    const viewportWidth = page.viewportSize()!.width; // 390
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThan(viewportWidth);

    // Active tab marked for a11y; siblings not.
    await expect(page.getByTestId('mobile-tab-campaigns')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('mobile-tab-shoot')).not.toHaveAttribute('aria-current', 'page');
  });
});
