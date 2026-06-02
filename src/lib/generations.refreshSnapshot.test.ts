import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- */
/* mocks                                                                       */
/* -------------------------------------------------------------------------- */

const { getWorkflowSnapshotMock, isTerminalMock } = vi.hoisted(() => ({
  getWorkflowSnapshotMock: vi.fn(),
  isTerminalMock: vi.fn(() => true),
}));

vi.mock('@/lib/civitai', () => ({
  getWorkflowSnapshot: getWorkflowSnapshotMock,
  isTerminal: isTerminalMock,
}));

// Drizzle: capture the .update().set().where().returning() chain so we can
// assert that updateGenerationFromSnapshot was invoked with the freshly
// fetched snapshot.
const capturedUpdates: Array<Record<string, unknown>> = [];

vi.mock('@/lib/db', () => {
  return {
    db: {
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({ returning: () => Promise.resolve([]) }),
          returning: () => Promise.resolve([]),
        }),
      }),
      update: () => ({
        set: (payload: Record<string, unknown>) => {
          capturedUpdates.push(payload);
          return {
            where: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    workflowId: 'wf_xyz',
                    userId: 'u1',
                    source: 'campaign',
                    sourceId: null,
                    tileId: null,
                    parentWorkflowId: null,
                    parentImageIndex: null,
                    mediaType: 'image',
                    status: payload.status ?? 'done',
                    prompt: null,
                    estimatedBuzz: 0,
                    chargedBuzz: payload.chargedBuzz ?? 0,
                    submittedAt: new Date(0),
                    finishedAt: payload.finishedAt ?? null,
                    updatedAt: payload.updatedAt ?? new Date(0),
                  },
                ]),
            }),
          };
        },
      }),
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: () => undefined,
  and: () => undefined,
}));

vi.mock('@/lib/db/schema', () => ({
  generations: {
    workflowId: 'generations.workflow_id',
  },
}));

import type { Session } from './session';
import { refreshGenerationSnapshot } from './generations';

function makeSession(token = 'tok_abc'): Session {
  return {
    tokens: {
      access_token: token,
      refresh_token: 'r',
      expires_at: Date.now() + 60_000,
      token_type: 'Bearer',
      scope: 0,
    } as Session['tokens'],
  };
}

/* -------------------------------------------------------------------------- */
/* tests                                                                       */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  capturedUpdates.length = 0;
  getWorkflowSnapshotMock.mockReset();
  isTerminalMock.mockReset().mockReturnValue(true);
});

describe('refreshGenerationSnapshot', () => {
  it('calls getWorkflowSnapshot, then persists the snapshot via updateGenerationFromSnapshot', async () => {
    // NB: the existing `mapSnapshotStatus` looks for the substring 'success'
    // (not 'succeeded'). Use a terminal-success string the mapper actually
    // recognises — anything containing 'success' / 'done' / 'complete'.
    const fresh = {
      id: 'wf_xyz',
      status: 'success',
      cost: { total: 12 },
      steps: [{ output: { images: [{ url: 'https://orch/1.png', available: true }] } }],
    };
    getWorkflowSnapshotMock.mockResolvedValueOnce(fresh);

    const session = makeSession();
    const result = await refreshGenerationSnapshot('wf_xyz', session);

    // SDK call happened with the session + workflow id
    expect(getWorkflowSnapshotMock).toHaveBeenCalledTimes(1);
    expect(getWorkflowSnapshotMock).toHaveBeenCalledWith(session, 'wf_xyz');

    // Update was issued against the generations table, snapshot column carries
    // the freshly-fetched snapshot.
    expect(capturedUpdates).toHaveLength(1);
    expect(capturedUpdates[0]!.snapshot).toBe(fresh);
    // Terminal snapshot → status mapped to 'done', chargedBuzz pulled from cost.
    expect(capturedUpdates[0]!.status).toBe('done');
    expect(capturedUpdates[0]!.chargedBuzz).toBe(12);

    // Returns the persisted row in the public Generation shape.
    expect(result).toMatchObject({ workflowId: 'wf_xyz', status: 'done' });
  });

  it('returns null when the workflow has no matching generations row', async () => {
    // Override the update().returning() to resolve with no rows.
    const fresh = { id: 'wf_missing', status: 'succeeded' };
    getWorkflowSnapshotMock.mockResolvedValueOnce(fresh);
    isTerminalMock.mockReturnValueOnce(true);

    // Reach into the mocked db to swap returning() behavior for this test only
    // — re-mock via vi.doMock isn't worth it; instead, capture and assert that
    // when the update layer returns [], refreshGenerationSnapshot returns null.
    const { db } = (await import('@/lib/db')) as {
      db: { update: (...args: unknown[]) => unknown };
    };
    const originalUpdate = db.update;
    db.update = () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([]) }),
      }),
    });

    try {
      const result = await refreshGenerationSnapshot('wf_missing', makeSession());
      expect(result).toBeNull();
      expect(getWorkflowSnapshotMock).toHaveBeenCalledWith(
        expect.anything(),
        'wf_missing',
      );
    } finally {
      db.update = originalUpdate;
    }
  });

  it('propagates errors from getWorkflowSnapshot (no DB write on failure)', async () => {
    getWorkflowSnapshotMock.mockRejectedValueOnce(new Error('orchestrator down'));
    await expect(
      refreshGenerationSnapshot('wf_oops', makeSession()),
    ).rejects.toThrow('orchestrator down');
    expect(capturedUpdates).toHaveLength(0);
  });
});
