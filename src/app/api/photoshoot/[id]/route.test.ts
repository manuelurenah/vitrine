import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { updatePhotoshootMock } = vi.hoisted(() => ({ updatePhotoshootMock: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/photoshoots', () => ({
  updatePhotoshoot: updatePhotoshootMock,
  deletePhotoshoot: vi.fn(),
}));

import { PATCH } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/photoshoot/p1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ tokens: {} });
  getUserKeyMock.mockResolvedValue('user_1');
  updatePhotoshootMock.mockResolvedValue({ id: 'p1', title: 'New' });
});

describe('PATCH /api/photoshoot/[id]', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest({ title: 'New' }) as never, makeParams());
    expect(res.status).toBe(401);
    expect(updatePhotoshootMock).not.toHaveBeenCalled();
  });

  it('returns 400 when title is empty after trim', async () => {
    const res = await PATCH(makeRequest({ title: '  ' }) as never, makeParams());
    expect(res.status).toBe(400);
    expect(updatePhotoshootMock).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const res = await PATCH(makeRequest({}) as never, makeParams());
    expect(res.status).toBe(400);
    expect(updatePhotoshootMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the photoshoot is not owned / missing', async () => {
    updatePhotoshootMock.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest({ title: 'New' }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it('trims the title and forwards it to updatePhotoshoot', async () => {
    const res = await PATCH(makeRequest({ title: '  New title  ' }) as never, makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updatePhotoshootMock).toHaveBeenCalledWith('user_1', 'p1', { title: 'New title' });
  });
});
