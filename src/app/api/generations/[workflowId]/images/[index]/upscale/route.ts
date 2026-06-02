import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generations } from '@/lib/db/schema';
import {
  estimateUpscale,
  extractImageUrls,
  OrchestratorError,
  submitUpscale,
  type WorkflowSnapshot,
} from '@/lib/civitai';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import {
  recordGeneration,
  refreshGenerationSnapshot,
} from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';

type Params = Promise<{ workflowId: string; index: string }>;

/**
 * Post-generation action: upscale a single completed image from a parent
 * workflow's snapshot. Submits a new orchestrator workflow against the source
 * image URL and persists a new `generations` row linked to the parent via
 * `parentWorkflowId` + `parentImageIndex`.
 */
export async function POST(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { workflowId, index: indexRaw } = await ctx.params;
  const index = Number(indexRaw);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'invalid_index' }, { status: 400 });
  }

  const userKey = await getUserKey(session);

  const [parentRow] = await db
    .select()
    .from(generations)
    .where(eq(generations.workflowId, workflowId))
    .limit(1);
  if (!parentRow) {
    return NextResponse.json({ error: 'workflow_not_found' }, { status: 404 });
  }
  if (parentRow.userId !== userKey) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Pull cached snapshot. Refresh if missing, empty, or has GC'd blobs.
  let snapshot = (parentRow.snapshot ?? null) as WorkflowSnapshot | null;
  let urls = snapshot ? extractImageUrls(snapshot) : [];
  const needsRefresh =
    !snapshot ||
    urls.length === 0 ||
    hasUnavailable(snapshot) ||
    index >= urls.length;
  if (needsRefresh) {
    try {
      const refreshed = await refreshGenerationSnapshot(workflowId, session);
      if (refreshed) {
        const [fresh] = await db
          .select()
          .from(generations)
          .where(eq(generations.workflowId, workflowId))
          .limit(1);
        snapshot = (fresh?.snapshot ?? null) as WorkflowSnapshot | null;
        urls = snapshot ? extractImageUrls(snapshot) : urls;
      }
    } catch {
      // fall through; index check below decides the response
    }
  }

  if (index >= urls.length) {
    return NextResponse.json({ error: 'image_index_out_of_range' }, { status: 404 });
  }
  const sourceUrl = urls[index]!;

  try {
    const [estimateSnap, submitSnap] = await Promise.all([
      estimateUpscale(session, sourceUrl),
      submitUpscale(session, sourceUrl),
    ]);

    const estimatedBuzz = estimateSnap.cost?.total ?? 0;
    const newWorkflowId = submitSnap.id;

    await recordGeneration({
      workflowId: newWorkflowId,
      userId: userKey,
      source: 'upscale',
      sourceId: parentRow.sourceId,
      tileId: parentRow.tileId,
      parentWorkflowId: workflowId,
      parentImageIndex: index,
      mediaType: 'image',
      prompt: parentRow.prompt ?? undefined,
      input: { sourceUrl },
      estimatedBuzz,
    });
    await recordBuzzEvent({
      userId: userKey,
      workflowId: newWorkflowId,
      kind: 'estimate',
      estimated: estimatedBuzz,
      note: 'upscale',
    });
    await recordBuzzEvent({
      userId: userKey,
      workflowId: newWorkflowId,
      kind: 'submit',
      estimated: estimatedBuzz,
      note: 'upscale',
    });

    return NextResponse.json({
      workflowId: newWorkflowId,
      estimatedBuzz,
      parentWorkflowId: workflowId,
      parentImageIndex: index,
    });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json(
        { error: 'orchestrator_error', detail: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: 'unknown', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function hasUnavailable(snapshot: WorkflowSnapshot): boolean {
  for (const step of snapshot.steps ?? []) {
    for (const img of step.output?.images ?? []) {
      if (img && img.available === false) return true;
    }
  }
  return false;
}
