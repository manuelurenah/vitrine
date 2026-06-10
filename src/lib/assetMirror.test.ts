import { beforeEach, describe, expect, it, vi } from 'vitest';

const { putObjectMock } = vi.hoisted(() => ({ putObjectMock: vi.fn() }));

vi.mock('@/lib/s3', () => ({
  putObject: putObjectMock,
}));

import { mirrorOrchestratorImage } from './assetMirror';

function makeResponse(body: Uint8Array, contentType: string, ok = true, status = 200): Response {
  // Wrap in a Buffer-friendly BodyInit. Casting via `BlobPart` keeps both DOM
  // and node typings happy across our `lib: dom` tsconfig.
  return new Response(body as unknown as BodyInit, {
    status,
    headers: { 'content-type': contentType },
    statusText: ok ? 'OK' : 'NO',
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  putObjectMock.mockReset();
  // Default: putObject echoes the inputs and produces a believable URL.
  putObjectMock.mockImplementation(
    async (opts: { key: string; bucketKind: 'asset' | 'upload' }) => ({
      bucket: opts.bucketKind === 'asset' ? 'assets' : 'uploads',
      key: opts.key,
      publicUrl: `https://cdn.test/${opts.bucketKind === 'asset' ? 'assets' : 'uploads'}/${opts.key}`,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

describe('mirrorOrchestratorImage', () => {
  it('uploads with key format generated/${userId}/${hash}.${ext} and returns mirror metadata', async () => {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    fetchMock.mockResolvedValueOnce(makeResponse(body, 'image/png'));

    const result = await mirrorOrchestratorImage('https://orch.test/output/abc', {
      userId: 'user_xyz',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://orch.test/output/abc');
    expect(putObjectMock).toHaveBeenCalledTimes(1);
    const callArg = putObjectMock.mock.calls[0]![0];
    expect(callArg.bucketKind).toBe('asset');
    expect(callArg.contentType).toBe('image/png');
    expect(callArg.contentLength).toBe(5);
    expect(callArg.body).toBeInstanceOf(Uint8Array);

    // Key format: generated/<userId>/<16-hex>.png
    expect(callArg.key).toMatch(/^generated\/user_xyz\/[a-f0-9]{16}\.png$/);

    expect(result).toEqual({
      bucket: 'assets',
      key: callArg.key,
      publicUrl: `https://cdn.test/assets/${callArg.key}`,
      contentType: 'image/png',
      byteSize: 5,
    });
  });

  it('maps image/jpeg -> jpg', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array([0]), 'image/jpeg'));
    await mirrorOrchestratorImage('https://orch.test/x.jpg', { userId: 'u1' });
    expect(putObjectMock.mock.calls[0]![0].key).toMatch(/\.jpg$/);
  });

  it('maps image/webp -> webp', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array([0]), 'image/webp'));
    await mirrorOrchestratorImage('https://orch.test/x.webp', { userId: 'u1' });
    expect(putObjectMock.mock.calls[0]![0].key).toMatch(/\.webp$/);
  });

  it('strips content-type parameters before mapping', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array([0]), 'image/png; charset=utf-8'));
    const result = await mirrorOrchestratorImage('https://orch.test/x.png', {
      userId: 'u1',
    });
    expect(result.contentType).toBe('image/png');
    expect(putObjectMock.mock.calls[0]![0].key).toMatch(/\.png$/);
  });

  it('falls back to .bin extension for unknown content-types', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array([0]), 'application/octet-stream'));
    await mirrorOrchestratorImage('https://orch.test/blob', { userId: 'u1' });
    expect(putObjectMock.mock.calls[0]![0].key).toMatch(/\.bin$/);
  });

  it('supports the upload bucket kind override', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array([0]), 'image/png'));
    const result = await mirrorOrchestratorImage('https://orch.test/x.png', {
      userId: 'u1',
      bucketKind: 'upload',
    });
    expect(putObjectMock.mock.calls[0]![0].bucketKind).toBe('upload');
    expect(result.bucket).toBe('uploads');
    expect(result.publicUrl).toContain('/uploads/');
  });

  it('throws when the source fetch returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } }),
    );
    await expect(
      mirrorOrchestratorImage('https://orch.test/missing', { userId: 'u1' }),
    ).rejects.toThrow(/failed_to_fetch_source/);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('throws when the source body is empty', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(new Uint8Array(), 'image/png'));
    await expect(
      mirrorOrchestratorImage('https://orch.test/empty', { userId: 'u1' }),
    ).rejects.toThrow(/empty_source_body/);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('produces a different key on successive calls for the same source url', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(new Uint8Array([1]), 'image/png'))
      .mockResolvedValueOnce(makeResponse(new Uint8Array([1]), 'image/png'));
    const a = await mirrorOrchestratorImage('https://orch.test/same.png', { userId: 'u1' });
    const b = await mirrorOrchestratorImage('https://orch.test/same.png', { userId: 'u1' });
    expect(a.key).not.toBe(b.key);
  });
});
