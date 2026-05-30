import { NextResponse, type NextRequest } from 'next/server';
import { createOrchestratorClient, isTerminal, OrchestratorError, pollWorkflow } from '@civitai/app-sdk/orchestrator';
import { env } from '@/lib/env';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { updateGenerationFromSnapshot } from '@/lib/generations';
import { markTileFailed, syncAssetsFromSnapshot } from '@/lib/assets';
import { recordBuzzEvent } from '@/lib/buzz';

/**
 * Long-poll endpoint. `?wait=<ms>` (capped at MAX_WAIT_MS) holds the
 * connection open and re-checks the orchestrator until the workflow reaches
 * a terminal status, then returns. The client just keeps re-hitting this
 * until `done: true` — single endpoint, no client-side timer.
 */

const MAX_WAIT_MS = 30_000; // stay under most proxy / Vercel function timeouts

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await ctx.params;
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
      const userKey = await getUserKey(session);
      const prevGen = await updateGenerationFromSnapshot(id, snapshot);
      const status = String(snapshot.status ?? '').toLowerCase();
      if (status.includes('fail') || status.includes('error')) {
        await markTileFailed(id, status || 'failed');
      } else {
        await syncAssetsFromSnapshot(userKey, snapshot);
      }
      const charged = snapshot.cost?.total ?? 0;
      if (charged > 0 && (!prevGen || prevGen.chargedBuzz !== charged)) {
        await recordBuzzEvent({
          userId: userKey,
          workflowId: id,
          kind: 'submit',
          charged,
          note: 'workflow_done',
        });
      }
    }

    return NextResponse.json({ snapshot, done });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json(
        { error: 'orchestrator_error', detail: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
