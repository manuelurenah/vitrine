import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { restoreTileVersionMock } = vi.hoisted(() => ({ restoreTileVersionMock: vi.fn() }));
const { deleteTileVersionMock } = vi.hoisted(() => ({ deleteTileVersionMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/tileVersions', () => ({
  restoreTileVersion: restoreTileVersionMock,
  deleteTileVersion: deleteTileVersionMock,
}));

import { DELETE, POST } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/campaigns/c1/tiles/t1/versions/2', { method: 'POST' });
}

function makeParams(id = 'c1', tileId = 't1', version = '2') {
  return { params: Promise.resolve({ id, tileId, version }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ tokens: {} });
  getUserKeyMock.mockResolvedValue('user_1');
  restoreTileVersionMock.mockResolvedValue({ id: 'r', version: 3, prompt: 'p', adCopy: null });
  deleteTileVersionMock.mockResolvedValue({ ok: true, version: 2 });
});

describe('POST (restore) /api/campaigns/[id]/tiles/[tileId]/versions/[version]', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 400 on a non-numeric version', async () => {
    const res = await POST(makeRequest(), makeParams('c1', 't1', 'abc'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_version');
  });

  it('returns 404 when restore target is missing', async () => {
    restoreTileVersionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('version_not_found');
  });

  it('restores and returns the new synthetic version', async () => {
    const res = await POST(makeRequest(), makeParams('c1', 't1', '2'));
    expect(res.status).toBe(200);
    expect(restoreTileVersionMock).toHaveBeenCalledWith('user_1', 'c1', 't1', 2);
    expect((await res.json()).version.version).toBe(3);
  });
});

describe('DELETE /api/campaigns/[id]/tiles/[tileId]/versions/[version]', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('deletes a version and returns ok', async () => {
    const res = await DELETE(makeRequest(), makeParams('c1', 't1', '2'));
    expect(res.status).toBe(200);
    expect(deleteTileVersionMock).toHaveBeenCalledWith('user_1', 'c1', 't1', 2);
    expect(await res.json()).toEqual({ ok: true, version: 2 });
  });

  it('returns 409 with the reason when the delete is refused', async () => {
    deleteTileVersionMock.mockResolvedValueOnce({
      ok: false,
      reason: "can't delete the current version",
    });
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("can't delete the current version");
  });
});
