import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { markOnboardingComplete, resetUserData } from './helpers/db';

test.describe('Asset uploader UI', () => {
  test.beforeAll(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('renders dropzone, collection select, and disabled submit until files are queued', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets/new`);

    await expect(page.getByRole('heading', { name: /add assets/i })).toBeVisible();
    await expect(page.getByText(/drop files here, or click to choose/i)).toBeVisible();
    await expect(page.getByLabel(/collection/i)).toBeVisible();
    await expect(page.getByLabel(/tags/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();

    const submit = page.getByRole('button', { name: /add to library/i });
    await expect(submit).toBeDisabled();
  });

  // Playwright's setInputFiles() doesn't propagate React state updates on
  // the hidden controlled input in Next 16 turbopack dev mode reliably. The
  // upload path itself is exercised by the presign/finalize API handlers
  // directly — re-enable once we either drag-and-drop instead or wire a
  // visible-file-input variant of the dropzone.
  test.fixme('stubbed upload of one image lands in the gallery', async ({
    page,
    baseURL,
    context,
  }) => {
    // Avoid hitting MinIO from the playwright runtime — stub the presign +
    // PUT + finalize roundtrip so we exercise the wiring without real S3.
    let finalizePayload: Record<string, unknown> | null = null;

    await context.route('**/api/assets/presign', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bucket: 'assets',
          key: 'e2e/stub-key.png',
          putUrl: 'http://stub.invalid/put',
          publicUrl: 'http://stub.invalid/assets/e2e/stub-key.png',
        }),
      }),
    );

    await context.route('http://stub.invalid/**', (route) =>
      route.fulfill({ status: 200, body: '' }),
    );

    await context.route('**/api/assets', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        finalizePayload = JSON.parse(request.postData() ?? '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ asset: { id: 'stub-id' } }),
        });
        return;
      }
      await route.continue();
    });

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand/assets/new`);

    const fileInput = page.locator('input[type=file]');
    await fileInput.setInputFiles({
      name: 'lumen-primary.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        // 1×1 transparent PNG
        '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C636000000002000148AFA4710000000049454E44AE426082',
        'hex',
      ),
    });

    await expect(page.getByText('lumen-primary.png')).toBeVisible();
    await page.getByLabel(/tags/i).fill('e2e, hero');
    await page.getByRole('button', { name: /add to library/i }).click();

    await page.waitForURL(/\/brand\/assets$/, { timeout: 15_000 });

    expect(finalizePayload).not.toBeNull();
    expect((finalizePayload as { bucket: string }).bucket).toBe('assets');
  });
});
