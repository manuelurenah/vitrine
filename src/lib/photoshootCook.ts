import 'server-only';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import type { PhotoshootTemplateId } from '@/lib/photoshootTemplates';
import { swapPhotoshootTileWorkflow, type PhotoshootTile } from '@/lib/photoshoots';
import type { Session } from '@/lib/session';

export type SubmittedWorkflow = {
  workflowId: string;
  prompt: string;
  estimatedCost: number;
  input: VitrineImageGenInput;
};

/**
 * Record generation + buzz-estimate audit trail for one photoshoot tile.
 * Called by both the cook route (after createPhotoshoot gives us tileId) and
 * the per-template regenerate route. Never skip this — the audit + UI depend on it.
 */
export async function recordPhotoshootTileAudit({
  workflowId,
  userId,
  photoshootId,
  tileId,
  prompt,
  input,
  estimatedCost,
  note,
}: {
  workflowId: string;
  userId: string;
  photoshootId: string;
  tileId: string;
  prompt: string;
  input: VitrineImageGenInput;
  estimatedCost: number;
  note: 'cook' | 'regenerate';
}): Promise<void> {
  await Promise.all([
    recordGeneration({
      workflowId,
      userId,
      source: 'photoshoot',
      sourceId: photoshootId,
      tileId,
      prompt,
      input: input as unknown as Record<string, unknown>,
      estimatedBuzz: estimatedCost,
    }),
    recordBuzzEvent({
      userId,
      workflowId,
      kind: 'estimate',
      estimated: estimatedCost,
      note,
    }),
  ]);
}

export type RegeneratePhotoshootTileResult =
  | { ok: true; tile: PhotoshootTile; workflowId: string; estimatedCost: number }
  | { ok: false; error: string; status: number };

/**
 * Submit a fresh workflow for one existing photoshoot tile, swap it in the DB,
 * and record the full audit trail. Used by both the per-tile and per-template
 * regenerate routes.
 */
export async function regeneratePhotoshootTile({
  session,
  userId,
  photoshootId,
  tileId,
  input,
  prompt,
}: {
  session: Session;
  userId: string;
  photoshootId: string;
  tileId: string;
  input: VitrineImageGenInput;
  prompt: string;
}): Promise<RegeneratePhotoshootTileResult> {
  let snap: Awaited<ReturnType<typeof submitImageGen>>;
  try {
    snap = await submitImageGen(session, input);
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return { ok: false, error: 'orchestrator_error', status: err.status };
    }
    return { ok: false, error: 'submit_failed', status: 502 };
  }

  const updated = await swapPhotoshootTileWorkflow(userId, photoshootId, tileId, snap.id);
  if (!updated) {
    return { ok: false, error: 'tile_not_found', status: 404 };
  }

  await recordPhotoshootTileAudit({
    workflowId: snap.id,
    userId,
    photoshootId,
    tileId,
    prompt,
    input,
    estimatedCost: snap.cost?.total ?? 0,
    note: 'regenerate',
  });

  return { ok: true, tile: updated, workflowId: snap.id, estimatedCost: snap.cost?.total ?? 0 };
}
