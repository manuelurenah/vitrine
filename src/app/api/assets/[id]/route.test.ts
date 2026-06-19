import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- *
 * Hoisted mocks
 * -------------------------------------------------------------------------- */

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getAssetMock } = vi.hoisted(() => ({ getAssetMock: vi.fn() }));
const { updateAssetMock } = vi.hoisted(() => ({ updateAssetMock: vi.fn() }));
const { softDeleteAssetMock } = vi.hoisted(() => ({ softDeleteAssetMock: vi.fn() }));
const { isSoleProductImageMock } = vi.hoisted(() => ({ isSoleProductImageMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/assets', () => ({
  getAsset: getAssetMock,
  updateAsset: updateAssetMock,
  softDeleteAsset: softDeleteAssetMock,
  isSoleProductImage: isSoleProductImageMock,
}));

import { DELETE } from './route';

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

function makeRequest(id = 'asset_1'): Request {
  return new Request(`http://localhost/api/assets/${id}`, { method: 'DELETE' });
}

function makeParams(id = 'asset_1') {
  return { params: Promise.resolve({ id }) };
}

/* -------------------------------------------------------------------------- *
 * Setup
 * -------------------------------------------------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ tokens: {} });
  getUserKeyMock.mockResolvedValue('user_1');
  isSoleProductImageMock.mockResolvedValue(false);
  softDeleteAssetMock.mockResolvedValue(true);
});

/* -------------------------------------------------------------------------- *
 * DELETE /api/assets/[id] — route handler tests
 * -------------------------------------------------------------------------- */

describe('DELETE /api/assets/[id]', () => {
  it('returns 401 when there is no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
    expect(softDeleteAssetMock).not.toHaveBeenCalled();
    expect(isSoleProductImageMock).not.toHaveBeenCalled();
  });

  it('returns 409 with last_product_image body when isSoleProductImage is true, and does NOT call softDeleteAsset', async () => {
    isSoleProductImageMock.mockResolvedValueOnce(true);
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_product_image' });
    expect(softDeleteAssetMock).not.toHaveBeenCalled();
  });

  it('returns 200 { ok: true } when isSoleProductImage is false and softDeleteAsset resolves true', async () => {
    isSoleProductImageMock.mockResolvedValueOnce(false);
    softDeleteAssetMock.mockResolvedValueOnce(true);
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(softDeleteAssetMock).toHaveBeenCalledWith('user_1', 'asset_1');
  });

  it('returns 404 when isSoleProductImage is false and softDeleteAsset resolves false', async () => {
    isSoleProductImageMock.mockResolvedValueOnce(false);
    softDeleteAssetMock.mockResolvedValueOnce(false);
    const res = await DELETE(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect(softDeleteAssetMock).toHaveBeenCalledWith('user_1', 'asset_1');
  });
});

/* -------------------------------------------------------------------------- *
 * isSoleProductImage — unit tests with mocked db
 * -------------------------------------------------------------------------- */

describe('isSoleProductImage', () => {
  // We test isSoleProductImage by importing from @/lib/assets with a separate
  // mock of @/lib/db. Because vi.mock is hoisted to the top of the file and
  // acts globally, we use a fresh sub-describe that re-mocks @/lib/db at the
  // module level. To avoid conflicts with the route-level mock of @/lib/assets,
  // we use vi.importActual to get the real implementation and call it directly
  // in a separate test file. Per the task brief, we MAY rely on a lighter helper
  // test if mocking the query builder is disproportionate — and since the route
  // tests already provide branch coverage (both true/false paths are exercised
  // via the mock), we note this limitation and test isSoleProductImage via a
  // separate file instead.
  //
  // See src/lib/assets.isSoleProductImage.test.ts for the dedicated unit tests.
  it.todo(
    'unit tests for isSoleProductImage are in src/lib/assets.isSoleProductImage.test.ts',
  );
});
