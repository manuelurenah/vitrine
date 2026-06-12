import {
  createOrchestratorClient,
  isTerminal,
  OrchestratorError,
  pollWorkflow,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
import { type NextRequest, NextResponse } from 'next/server';
import { markTileFailed, syncAssetsFromSnapshot } from '@/lib/assets';
import { recordBuzzEvent } from '@/lib/buzz';
import { env } from '@/lib/env';
import {
  getGeneration,
  refreshGenerationSnapshot,
  updateGenerationFromSnapshot,
} from '@/lib/generations';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

/**
 * Long-poll endpoint. `?wait=<ms>` (capped at MAX_WAIT_MS) holds the
 * connection open and re-checks the orchestrator until the workflow reaches
 * a terminal status, then returns. The client just keeps re-hitting this
 * until `done: true` — single endpoint, no client-side timer.
 */

const MAX_WAIT_MS = 30_000; // stay under most proxy / Vercel function timeouts

/**
 * Successful terminal status check. Matches `succe`(eded/ss) — note the
 * canonical orchestrator status is `succeeded`, which does NOT contain the
 * substring `success`, so we key off the shared `succe` prefix instead.
 */
function isSuccess(snapshot: WorkflowSnapshot): boolean {
  const s = String(snapshot.status ?? '').toLowerCase();
  return s.includes('succe') || s.includes('done') || s.includes('complete');
}

/**
 * The orchestrator can GC image blobs while still resolving the workflow.
 * When that happens, individual `images[].available` flips to `false`. We
 * detect that and re-fetch a fresh snapshot in case the orchestrator has
 * since restored the URLs (or to confirm they are permanently gone).
 */
function hasUnavailableImage(snapshot: WorkflowSnapshot): boolean {
  for (const step of snapshot.steps ?? []) {
    for (const img of step.output?.images ?? []) {
      if (img && img.available === false) return true;
    }
  }
  return false;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await ctx.params;
  const userKey = await getUserKey(session);

  // Ownership check: the workflow must belong to the requesting user. Without
  // this any auth'd user could poll/mutate any workflow by ID. We return 404
  // (not 403) so callers can't enumerate workflow IDs.
  const owned = await getGeneration(id);
  if (!owned || owned.userId !== userKey) {
    return NextResponse.json({ error: 'workflow_not_found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const waitRaw = Number(url.searchParams.get('wait') ?? 0);
  const waitMs = Number.isFinite(waitRaw) ? Math.min(Math.max(waitRaw, 0), MAX_WAIT_MS) : 0;

  const client = createOrchestratorClient({
    accessToken: session.tokens.access_token,
    baseUrl: env.ORCHESTRATOR_URL,
  });

  try {
    const snapshot = await pollWorkflow(client, id, {
      timeoutMs: waitMs,
      signal: req.signal,
    });

    const done = isTerminal(snapshot);
    if (done) {
      const charged = snapshot.cost?.total ?? 0;
      // Capture the previous chargedBuzz BEFORE updating so we can correctly
      // dedupe the `submit` buzz event across re-polls. `owned` was read at
      // the top of this request and still reflects pre-update state.
      const previouslyCharged = owned.chargedBuzz;
      await updateGenerationFromSnapshot(id, snapshot);
      const status = String(snapshot.status ?? '').toLowerCase();
      if (status.includes('fail') || status.includes('error')) {
        await markTileFailed(id, status || 'failed');
      } else if (isSuccess(snapshot)) {
        // Terminal success: create asset rows from the produced images and flip
        // the originating tile to `done`. Idempotent (onConflictDoNothing on
        // bucket+storageKey) so repeated terminal polls don't duplicate assets.
        // Without this the tile's DB status stays `cooking` forever and the
        // campaign/photoshoot badges never resolve.
        await syncAssetsFromSnapshot(userKey, snapshot);
      }
      if (charged > 0 && previouslyCharged !== charged) {
        await recordBuzzEvent({
          userId: userKey,
          workflowId: id,
          kind: 'submit',
          charged,
          note: 'workflow_done',
        });
      }

      // If the workflow succeeded but the orchestrator has GC'd one or more
      // blob URLs, refresh the snapshot once so the cached copy reflects the
      // latest URLs. Best-effort — fall back to the originally polled
      // snapshot on failure so we never break the long-poll loop.
      if (isSuccess(snapshot) && hasUnavailableImage(snapshot)) {
        try {
          await refreshGenerationSnapshot(id, session);
        } catch {
          // swallow — caller still gets the polled snapshot below
        }
      }
    }

    return NextResponse.json({ snapshot, done });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
