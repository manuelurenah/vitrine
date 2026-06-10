import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- */
/* mocks                                                                       */
/* -------------------------------------------------------------------------- */

// Capture every set of values passed into db.insert(...).values(...).
const capturedInserts: Array<Record<string, unknown>> = [];

vi.mock('@/lib/civitai', () => ({
  getWorkflowSnapshot: vi.fn(),
  isTerminal: vi.fn(() => true),
}));

vi.mock('@/lib/db', () => {
  return {
    db: {
      insert: () => ({
        values: (payload: Record<string, unknown>) => {
          capturedInserts.push(payload);
          const row = {
            workflowId: payload.workflowId,
            userId: payload.userId,
            source: payload.source,
            sourceId: payload.sourceId ?? null,
            tileId: payload.tileId ?? null,
            parentWorkflowId: payload.parentWorkflowId ?? null,
            parentImageIndex: payload.parentImageIndex ?? null,
            mediaType: payload.mediaType ?? 'image',
            status: payload.status ?? 'queued',
            prompt: payload.prompt ?? null,
            estimatedBuzz: payload.estimatedBuzz ?? 0,
            chargedBuzz: 0,
            submittedAt: new Date(0),
            finishedAt: null,
            updatedAt: new Date(0),
          };
          return {
            onConflictDoUpdate: () => ({
              returning: () => Promise.resolve([row]),
            }),
            returning: () => Promise.resolve([row]),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({ returning: () => Promise.resolve([]) }),
        }),
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
  generations: { workflowId: 'generations.workflow_id' },
}));

import { type GenerationSource, recordGeneration } from './generations';

beforeEach(() => {
  capturedInserts.length = 0;
});

describe('recordGeneration', () => {
  const sources: GenerationSource[] = ['campaign', 'photoshoot', 'adhoc', 'upscale', 'animate'];

  for (const source of sources) {
    it(`persists source=${source} with correct columns`, async () => {
      const result = await recordGeneration({
        workflowId: `wf_${source}`,
        userId: 'user_1',
        source,
        sourceId: source === 'campaign' || source === 'photoshoot' ? 'src_1' : null,
        tileId: source === 'campaign' || source === 'photoshoot' ? 'tile_1' : null,
        prompt: `prompt for ${source}`,
        input: { prompt: `prompt for ${source}`, aspectRatio: '1:1' },
        estimatedBuzz: 7,
      });
      expect(capturedInserts).toHaveLength(1);
      const insert = capturedInserts[0]!;
      expect(insert.workflowId).toBe(`wf_${source}`);
      expect(insert.userId).toBe('user_1');
      expect(insert.source).toBe(source);
      expect(insert.prompt).toBe(`prompt for ${source}`);
      expect(insert.estimatedBuzz).toBe(7);
      expect(insert.mediaType).toBe('image');
      expect(insert.status).toBe('queued');
      // Public Generation shape returned.
      expect(result.workflowId).toBe(`wf_${source}`);
      expect(result.source).toBe(source);
    });
  }

  it('round-trips parentWorkflowId + parentImageIndex for post-gen rows (upscale)', async () => {
    await recordGeneration({
      workflowId: 'wf_upscale_1',
      userId: 'user_1',
      source: 'upscale',
      parentWorkflowId: 'wf_parent',
      parentImageIndex: 2,
      mediaType: 'image',
      prompt: 'upscale',
      input: { prompt: 'upscale', sourceUrl: 'https://orch/x.png' },
    });
    const insert = capturedInserts[0]!;
    expect(insert.parentWorkflowId).toBe('wf_parent');
    expect(insert.parentImageIndex).toBe(2);
  });

  it('round-trips parentWorkflowId + parentImageIndex for animate rows with mediaType=video', async () => {
    await recordGeneration({
      workflowId: 'wf_animate_1',
      userId: 'user_1',
      source: 'animate',
      parentWorkflowId: 'wf_parent',
      parentImageIndex: 0,
      mediaType: 'video',
      prompt: 'animate',
      input: { prompt: 'animate', sourceUrl: 'https://orch/x.png' },
    });
    const insert = capturedInserts[0]!;
    expect(insert.parentWorkflowId).toBe('wf_parent');
    expect(insert.parentImageIndex).toBe(0);
    expect(insert.mediaType).toBe('video');
  });

  it('falls back to input.prompt when prompt arg omitted', async () => {
    await recordGeneration({
      workflowId: 'wf_fallback',
      userId: 'user_1',
      source: 'campaign',
      input: { prompt: 'from input', aspectRatio: '4:5' },
    });
    expect(capturedInserts[0]!.prompt).toBe('from input');
  });

  it('persists input record as-is in the input column', async () => {
    const payload = { prompt: 'p', aspectRatio: '1:1', images: ['a', 'b'] };
    await recordGeneration({
      workflowId: 'wf_input',
      userId: 'user_1',
      source: 'campaign',
      input: payload,
    });
    expect(capturedInserts[0]!.input).toEqual(payload);
  });

  it('defaults sourceId/tileId/parentWorkflowId/parentImageIndex to null when omitted', async () => {
    await recordGeneration({
      workflowId: 'wf_defaults',
      userId: 'user_1',
      source: 'adhoc',
      input: { prompt: 'p' },
    });
    const insert = capturedInserts[0]!;
    expect(insert.sourceId).toBeNull();
    expect(insert.tileId).toBeNull();
    expect(insert.parentWorkflowId).toBeNull();
    expect(insert.parentImageIndex).toBeNull();
    expect(insert.estimatedBuzz).toBe(0);
  });
});
