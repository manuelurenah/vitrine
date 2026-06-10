import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/userKey', () => ({ getUserKey: vi.fn() }));
vi.mock('@/lib/catalog', () => ({ appendProductImages: vi.fn() }));

import { appendProductImages } from '@/lib/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

function reqWith(body: unknown) {
  return new Request('http://t/p/123/images', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/catalog/products/[id]/images', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 when no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(reqWith({ assetIds: ['a'] }) as never, {
      params: Promise.resolve({ id: 'p' }),
    });
    expect(res.status).toBe(401);
  });

  it('400 on invalid body', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    const res = await POST(reqWith({ assetIds: [] }) as never, {
      params: Promise.resolve({ id: 'p' }),
    });
    expect(res.status).toBe(400);
  });

  it('404 when product not owned', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    vi.mocked(appendProductImages).mockResolvedValue(null);
    const res = await POST(
      reqWith({ assetIds: ['11111111-1111-1111-1111-111111111111'] }) as never,
      { params: Promise.resolve({ id: 'p' }) },
    );
    expect(res.status).toBe(404);
  });

  it('200 on success', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    vi.mocked(appendProductImages).mockResolvedValue({
      product: { id: 'p', userId: 'u1' } as never,
      addedCount: 1,
      skippedCount: 0,
    });
    const res = await POST(
      reqWith({ assetIds: ['11111111-1111-1111-1111-111111111111'] }) as never,
      { params: Promise.resolve({ id: 'p' }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.addedCount).toBe(1);
  });
});
