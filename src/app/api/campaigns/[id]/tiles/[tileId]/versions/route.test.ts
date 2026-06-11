import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { listTileVersionsMock } = vi.hoisted(() => ({ listTileVersionsMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/tileVersions', () => ({ listTileVersions: listTileVersionsMock }));

import { GET } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/campaigns/c1/tiles/t1/versions');
}

function makeParams(id = 'c1', tileId = 't1') {
  return { params: Promise.resolve({ id, tileId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ tokens: {} });
  getUserKeyMock.mockResolvedValue('user_1');
  listTileVersionsMock.mockResolvedValue([]);
});

describe('GET /api/campaigns/[id]/tiles/[tileId]/versions', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns versions for the owning user', async () => {
    const versions = [
      { id: 'v1', version: 1, prompt: 'p', adCopy: null, assetId: null, changeNote: null },
    ];
    listTileVersionsMock.mockResolvedValueOnce(versions);
    const res = await GET(makeRequest(), makeParams('c1', 't1'));
    expect(res.status).toBe(200);
    expect(listTileVersionsMock).toHaveBeenCalledWith('user_1', 'c1', 't1');
    expect((await res.json()).versions).toEqual(versions);
  });
});
