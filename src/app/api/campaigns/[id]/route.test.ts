import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { updateCampaignMock } = vi.hoisted(() => ({ updateCampaignMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/campaigns', () => ({
  updateCampaign: updateCampaignMock,
  deleteCampaign: vi.fn(),
}));

import { PATCH } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/campaigns/c1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id = 'c1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ tokens: {} });
  getUserKeyMock.mockResolvedValue('user_1');
  updateCampaignMock.mockResolvedValue({ id: 'c1', title: 'New', brief: { description: 'd' } });
});

describe('PATCH /api/campaigns/[id]', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest({ title: 'New' }) as never, makeParams());
    expect(res.status).toBe(401);
    expect(updateCampaignMock).not.toHaveBeenCalled();
  });

  it('returns 400 when title is empty after trim', async () => {
    const res = await PATCH(makeRequest({ title: '   ' }) as never, makeParams());
    expect(res.status).toBe(400);
    expect(updateCampaignMock).not.toHaveBeenCalled();
  });

  it('returns 400 when no editable field is provided', async () => {
    const res = await PATCH(makeRequest({}) as never, makeParams());
    expect(res.status).toBe(400);
    expect(updateCampaignMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the campaign is not owned / missing', async () => {
    updateCampaignMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest({ title: 'New' }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it('trims the title and forwards both fields to updateCampaign', async () => {
    const res = await PATCH(
      makeRequest({ title: '  New title  ', description: '  desc  ' }) as never,
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateCampaignMock).toHaveBeenCalledWith('user_1', 'c1', {
      title: 'New title',
      description: 'desc',
    });
  });

  it('allows clearing the description to an empty string', async () => {
    const res = await PATCH(makeRequest({ description: '' }) as never, makeParams());
    expect(res.status).toBe(200);
    expect(updateCampaignMock).toHaveBeenCalledWith('user_1', 'c1', { description: '' });
  });
});
