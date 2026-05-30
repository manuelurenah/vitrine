import { expect, test } from './fixtures';

test.describe('Public API smoke', () => {
  test('GET /api/health returns 200', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json().catch(() => ({}));
    expect(body).toBeTruthy();
  });
});
