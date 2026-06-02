import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ----------------------------------------------------------

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
const { getUserKeyMock } = vi.hoisted(() => ({ getUserKeyMock: vi.fn() }));
const { getGenerationMock } = vi.hoisted(() => ({ getGenerationMock: vi.fn() }));
const { refreshGenerationSnapshotMock } = vi.hoisted(() => ({
  refreshGenerationSnapshotMock: vi.fn(),
}));
const { extractImageUrlsMock } = vi.hoisted(() => ({ extractImageUrlsMock: vi.fn() }));
const { mirrorOrchestratorImageMock } = vi.hoisted(() => ({
  mirrorOrchestratorImageMock: vi.fn(),
}));
const { createAssetMock } = vi.hoisted(() => ({ createAssetMock: vi.fn() }));

// db.select(...).from(...).where(...).limit(...) consumes a queued snapshot.
const snapshotRowQueue: Array<{ snapshot: unknown } | undefined> = [];

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }));
vi.mock('@/lib/userKey', () => ({ getUserKey: getUserKeyMock }));
vi.mock('@/lib/civitai', () => ({
  extractImageUrls: extractImageUrlsMock,
}));
vi.mock('@/lib/generations', () => ({
  getGeneration: getGenerationMock,
  refreshGenerationSnapshot: refreshGenerationSnapshotMock,
}));
vi.mock('@/lib/assets', () => ({
  createAsset: createAssetMock,
}));
vi.mock('@/lib/assetMirror', () => ({
  mirrorOrchestratorImage: mirrorOrchestratorImageMock,
}));
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const next = snapshotRowQueue.shift();
            return Promise.resolve(next ? [next] : []);
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/lib/db/schema', () => ({
  generations: { workflowId: 'generations.workflow_id', snapshot: 'generations.snapshot' },
}));
vi.mock('drizzle-orm', () => ({ eq: () => undefined }));

import { POST } from './route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/assets/generate/save', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeGen(over: Record<string, unknown> = {}) {
  return {
    workflowId: 'wf_1',
    userId: 'user_1',
    source: 'adhoc',
    sourceId: null,
    tileId: null,
    parentWorkflowId: null,
    parentImageIndex: null,
    mediaType: 'image',
    status: 'done',
    prompt: 'a sunlit kitchen',
    estimatedBuzz: 0,
    chargedBuzz: 7,
    submittedAt: 0,
    finishedAt: 0,
    updatedAt: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  snapshotRowQueue.length = 0;
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
  getGenerationMock.mockResolvedValue(makeGen());
  refreshGenerationSnapshotMock.mockResolvedValue(null);
  extractImageUrlsMock.mockReturnValue([
    'https://cdn.test/img-0.png',
    'https://cdn.test/img-1.png',
    'https://cdn.test/img-2.png',
  ]);
  // Cached snapshot present so refresh isn't triggered.
  snapshotRowQueue.push({ snapshot: { id: 'wf_1', status: 'succeeded' } });
  mirrorOrchestratorImageMock.mockImplementation(async (url: string) => ({
    bucket: 'assets',
    key: `generated/user_1/${url.replace(/[^a-z0-9]/gi, '').slice(-8)}.png`,
    publicUrl: `https://r2.test/${url.replace(/[^a-z0-9]/gi, '').slice(-8)}.png`,
    contentType: 'image/png',
    byteSize: 1024,
  }));
  let n = 0;
  createAssetMock.mockImplementation(async (input: { workflowId: string }) => ({
    id: `asset_${++n}`,
    userId: 'user_1',
    kind: 'generated',
    workflowId: input.workflowId,
  }));
});

describe('POST /api/assets/generate/save', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ workflowId: 'wf_1', imageIndexes: [0] }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body (missing workflowId)', async () => {
    const res = await POST(makeRequest({ imageIndexes: [0] }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid body (empty imageIndexes)', async () => {
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [] }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid body (negative imageIndex)', async () => {
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [-1] }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when generation row is missing', async () => {
    getGenerationMock.mockResolvedValueOnce(null);
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0] }) as never,
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('workflow_not_found');
    expect(mirrorOrchestratorImageMock).not.toHaveBeenCalled();
  });

  it('returns 404 when workflow belongs to a different user', async () => {
    getGenerationMock.mockResolvedValueOnce(makeGen({ userId: 'someone_else' }));
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0] }) as never,
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('workflow_not_found');
    expect(mirrorOrchestratorImageMock).not.toHaveBeenCalled();
  });

  it('returns 400 when every requested index is out of range', async () => {
    extractImageUrlsMock.mockReturnValue(['https://cdn.test/only-one.png']);
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [5, 6] }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_images_saved');
    expect(body.failures).toHaveLength(2);
    expect(body.failures[0]).toMatchObject({
      imageIndex: 5,
      error: 'image_index_out_of_range',
    });
    expect(mirrorOrchestratorImageMock).not.toHaveBeenCalled();
  });

  it('returns 200 with savedAssetIds for every successfully mirrored image', async () => {
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0, 2] }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedAssetIds).toHaveLength(2);
    expect(body.failures).toBeUndefined();

    expect(mirrorOrchestratorImageMock).toHaveBeenCalledTimes(2);
    expect(mirrorOrchestratorImageMock.mock.calls[0]![0]).toBe('https://cdn.test/img-0.png');
    expect(mirrorOrchestratorImageMock.mock.calls[0]![1]).toEqual({ userId: 'user_1' });
    expect(mirrorOrchestratorImageMock.mock.calls[1]![0]).toBe('https://cdn.test/img-2.png');

    expect(createAssetMock).toHaveBeenCalledTimes(2);
    const firstAsset = createAssetMock.mock.calls[0]![0];
    expect(firstAsset).toMatchObject({
      userId: 'user_1',
      kind: 'generated',
      ownerType: 'user',
      workflowId: 'wf_1',
      contentType: 'image/png',
      byteSize: 1024,
    });
    expect(firstAsset.metadata).toMatchObject({
      generation: {
        workflowId: 'wf_1',
        imageIndex: 0,
        prompt: 'a sunlit kitchen',
      },
    });
  });

  it('returns 200 with partial savedAssetIds + failures when one index is out of range', async () => {
    extractImageUrlsMock.mockReturnValue([
      'https://cdn.test/img-0.png',
      'https://cdn.test/img-1.png',
    ]);
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0, 9] }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedAssetIds).toHaveLength(1);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0]).toMatchObject({
      imageIndex: 9,
      error: 'image_index_out_of_range',
    });
    expect(mirrorOrchestratorImageMock).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with partial savedAssetIds + failures when one mirror throws', async () => {
    mirrorOrchestratorImageMock
      .mockResolvedValueOnce({
        bucket: 'assets',
        key: 'generated/user_1/aaaa.png',
        publicUrl: 'https://r2.test/aaaa.png',
        contentType: 'image/png',
        byteSize: 100,
      })
      .mockRejectedValueOnce(new Error('failed_to_fetch_source: status=404'));
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0, 1] }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedAssetIds).toHaveLength(1);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0]).toMatchObject({ imageIndex: 1 });
    expect(body.failures[0].error).toMatch(/failed_to_fetch_source/);
    expect(createAssetMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the snapshot when cached snapshot is missing', async () => {
    // Override default: first read returns no row, second read (after refresh)
    // returns a freshly-populated snapshot.
    snapshotRowQueue.length = 0;
    snapshotRowQueue.push(undefined);
    snapshotRowQueue.push({ snapshot: { id: 'wf_1', status: 'succeeded' } });

    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0] }) as never,
    );
    expect(res.status).toBe(200);
    expect(refreshGenerationSnapshotMock).toHaveBeenCalledTimes(1);
    expect(refreshGenerationSnapshotMock.mock.calls[0]![0]).toBe('wf_1');
  });

  it('refreshes the snapshot when any cached image is unavailable', async () => {
    snapshotRowQueue.length = 0;
    snapshotRowQueue.push({
      snapshot: {
        id: 'wf_1',
        status: 'succeeded',
        steps: [{ output: { images: [{ available: false }] } }],
      },
    });
    snapshotRowQueue.push({
      snapshot: {
        id: 'wf_1',
        status: 'succeeded',
        steps: [{ output: { images: [{ available: true }] } }],
      },
    });
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0] }) as never,
    );
    expect(res.status).toBe(200);
    expect(refreshGenerationSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates repeated indexes in the request body', async () => {
    const res = await POST(
      makeRequest({ workflowId: 'wf_1', imageIndexes: [0, 0, 1] }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedAssetIds).toHaveLength(2);
    expect(mirrorOrchestratorImageMock).toHaveBeenCalledTimes(2);
  });
});
