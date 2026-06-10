import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getCampaignMock } = vi.hoisted(() => ({ getCampaignMock: vi.fn() }));
const { listCampaignAssetsMock } = vi.hoisted(() => ({
  listCampaignAssetsMock: vi.fn(),
}));
const { buildZipStoredMock } = vi.hoisted(() => ({ buildZipStoredMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/campaigns', () => ({
  getCampaign: getCampaignMock,
  listCampaignAssets: listCampaignAssetsMock,
}));
vi.mock('@/lib/zip', () => ({
  buildZipStored: buildZipStoredMock,
}));

import { GET } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/campaigns/c1/export');
}

function makeParams(id = 'c1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default a logged-in session + user.
  getSessionMock.mockResolvedValue({
    tokens: {
      access_token: 'tok',
      refresh_token: 'r',
      expires_at: Date.now() + 60_000,
      token_type: 'Bearer',
      scope: 0,
    },
  });
  getUserKeyMock.mockResolvedValue('user_1');
  buildZipStoredMock.mockReturnValue(new Uint8Array([0x50, 0x4b]));
  // Default global fetch returns one image byte per call.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new Uint8Array([0xff]).buffer,
    })),
  );
});

describe('GET /api/campaigns/[id]/export', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest() as never, makeParams());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('not_authenticated');
  });

  it('returns 404 when campaign not found', async () => {
    getCampaignMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest() as never, makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('returns 409 when campaign has no completed tiles', async () => {
    getCampaignMock.mockResolvedValueOnce({ id: 'c1', title: 'Spring' });
    listCampaignAssetsMock.mockResolvedValueOnce([]);
    const res = await GET(makeRequest() as never, makeParams());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('no_assets');
  });

  it('returns 200 zip stream with expected entries when tiles are done', async () => {
    getCampaignMock.mockResolvedValueOnce({ id: 'c1', title: 'Spring Launch' });
    listCampaignAssetsMock.mockResolvedValueOnce([
      {
        tileId: 't1',
        presetId: 'ig-feed',
        publicUrl: 'https://cdn.test/a.png',
        contentType: 'image/png',
      },
      {
        tileId: 't2',
        presetId: 'ig-story',
        publicUrl: 'https://cdn.test/b.jpg',
        contentType: 'image/jpeg',
      },
    ]);

    const res = await GET(makeRequest() as never, makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('Spring-Launch.zip');

    expect(buildZipStoredMock).toHaveBeenCalledTimes(1);
    const passedEntries = buildZipStoredMock.mock.calls[0]![0] as Array<{
      name: string;
    }>;
    expect(passedEntries.map((e) => e.name)).toEqual(['01-ig-feed.png', '02-ig-story.jpg']);
  });

  it('returns 502 when an asset fetch fails', async () => {
    getCampaignMock.mockResolvedValueOnce({ id: 'c1', title: 't' });
    listCampaignAssetsMock.mockResolvedValueOnce([
      {
        tileId: 't1',
        presetId: 'ig-feed',
        publicUrl: 'https://cdn.test/a.png',
        contentType: 'image/png',
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    );
    const res = await GET(makeRequest() as never, makeParams());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('fetch_failed');
  });
});
