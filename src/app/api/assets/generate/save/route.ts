import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { extractImageUrls, type WorkflowSnapshot } from '@/lib/civitai';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { createAsset } from '@/lib/assets';
import {
  getGeneration,
  refreshGenerationSnapshot,
} from '@/lib/generations';
import { mirrorOrchestratorImage } from '@/lib/assetMirror';

const saveSchema = z.object({
  workflowId: z.string().min(1),
  imageIndexes: z.array(z.number().int().nonnegative()).min(1).max(8),
});

type SaveFailure = { imageIndex: number; error: string };

/**
 * Mirror selected images from an ad-hoc generation's snapshot into our own
 * R2/MinIO storage and create durable `assets` rows pointing at them.
 *
 * Per the Phase-2 plan, we only mirror images the user explicitly chooses to
 * keep — discarded outputs leave no asset rows and remain ephemeral.
 *
 * Ownership: every DB read is scoped to the requesting user's key. Workflows
 * that don't belong to the caller are surfaced as 404 (not 403) so callers
 * can't enumerate workflow IDs.
 *
 * Partial success is allowed: out-of-range / failed mirrors are collected in
 * `failures[]` while successful saves still land. Status codes:
 *   - 200 if at least one save succeeded
 *   - 400 if every requested image failed
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { workflowId, imageIndexes } = parsed.data;

  const userKey = await getUserKey(session);

  const gen = await getGeneration(workflowId);
  if (!gen || gen.userId !== userKey) {
    // Same pattern as /api/workflow/[id] — 404 (not 403) to prevent
    // workflow-id enumeration via response-code probing.
    return NextResponse.json({ error: 'workflow_not_found' }, { status: 404 });
  }

  // Pull the latest snapshot. Refresh from the orchestrator if we have no
  // cached copy or any image has `available: false` (blob GC'd by the
  // orchestrator). `refreshGenerationSnapshot` persists the fresh copy.
  let snapshot = await readGenerationSnapshot(workflowId);
  if (snapshot == null || hasUnavailable(snapshot)) {
    try {
      await refreshGenerationSnapshot(workflowId, session);
      snapshot = await readGenerationSnapshot(workflowId);
    } catch {
      // Fall through — handled by the empty-urls branch below.
    }
  }

  const urls = snapshot ? extractImageUrls(snapshot) : [];

  const failures: SaveFailure[] = [];
  const validIndexes: number[] = [];
  // De-duplicate so a client that sends [0, 0] doesn't mirror twice.
  const seen = new Set<number>();
  for (const idx of imageIndexes) {
    if (seen.has(idx)) continue;
    seen.add(idx);
    if (idx >= urls.length) {
      failures.push({ imageIndex: idx, error: 'image_index_out_of_range' });
    } else {
      validIndexes.push(idx);
    }
  }

  const results = await Promise.all(
    validIndexes.map(async (imageIndex) => {
      const sourceUrl = urls[imageIndex]!;
      try {
        const mirror = await mirrorOrchestratorImage(sourceUrl, { userId: userKey });
        const asset = await createAsset({
          userId: userKey,
          kind: 'generated',
          ownerType: 'user',
          bucket: mirror.bucket,
          storageKey: mirror.key,
          publicUrl: mirror.publicUrl,
          contentType: mirror.contentType,
          byteSize: mirror.byteSize,
          workflowId,
          metadata: {
            generation: {
              workflowId,
              imageIndex,
              prompt: gen.prompt ?? null,
            },
          },
        });
        return { ok: true as const, assetId: asset.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, imageIndex, error: message };
      }
    }),
  );

  const savedAssetIds: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.ok) {
      savedAssetIds.push(r.assetId);
    } else {
      failures.push({ imageIndex: validIndexes[i]!, error: r.error });
    }
  }

  if (savedAssetIds.length === 0) {
    return NextResponse.json(
      { error: 'no_images_saved', failures },
      { status: 400 },
    );
  }

  return NextResponse.json(
    failures.length > 0 ? { savedAssetIds, failures } : { savedAssetIds },
  );
}

/**
 * Pull the cached `snapshot` jsonb off the `generations` row. We re-query
 * after `refreshGenerationSnapshot` so we read the freshly persisted copy
 * rather than rely on the returned wrapper (which doesn't expose the raw
 * snapshot).
 */
async function readGenerationSnapshot(
  workflowId: string,
): Promise<WorkflowSnapshot | null> {
  const { db } = await import('@/lib/db');
  const { generations } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [row] = await db
    .select({ snapshot: generations.snapshot })
    .from(generations)
    .where(eq(generations.workflowId, workflowId))
    .limit(1);
  return (row?.snapshot ?? null) as WorkflowSnapshot | null;
}

function hasUnavailable(snapshot: WorkflowSnapshot): boolean {
  for (const step of snapshot.steps ?? []) {
    for (const img of step.output?.images ?? []) {
      if (img && img.available === false) return true;
    }
  }
  return false;
}
