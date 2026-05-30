import { expect, test } from './fixtures';

/**
 * Cost-preview flow is being rewired through the Vitrine campaign brief
 * (whatif=true on /api/generate/estimate). The legacy GenerateForm demo has
 * been retired. Re-enable + rewrite this spec once the brief modal calls
 * the estimate endpoint and surfaces the Buzz cost inline.
 */
test.describe.skip('Generation cost preview (pending rewire through brief modal)', () => {
  test('estimate (whatif=true) returns a non-negative Buzz cost', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await expect(page).toHaveURL(/\/campaigns/);
  });
});
