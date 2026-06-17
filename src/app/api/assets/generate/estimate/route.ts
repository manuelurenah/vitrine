import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { estimateImageGen, OrchestratorError, type VitrineImageGenInput } from '@/lib/civitai';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const MAX_PROMPT_CHARS = 4000;

const estimateSchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
  negativePrompt: z.string().max(MAX_PROMPT_CHARS).optional(),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9', '8:1', '4:1', '5:4']),
  numImages: z.number().int().min(1).max(4),
  resolution: z.enum(['1K', '2K']).optional(),
  referenceAssetIds: z.array(z.string()).max(4).default([]),
});

/**
 * Whatif-only estimate for the ad-hoc generation modal. Returns the orchestrator's
 * predicted buzz cost without submitting. Free + stateless (no DB writes, no
 * buzz events recorded — see Phase 1 fix CORR-3).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const parsed = estimateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { prompt, negativePrompt, aspectRatio, numImages, resolution, referenceAssetIds } =
    parsed.data;

  const userKey = await getUserKey(session);

  let refUrls: string[] = [];
  if (referenceAssetIds.length > 0) {
    try {
      refUrls = await getPublicUrls(userKey, referenceAssetIds);
    } catch (err) {
      if (err instanceof MissingReferenceError) {
        return NextResponse.json(
          { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
          { status: 400 },
        );
      }
      throw err;
    }
  }

  const input: VitrineImageGenInput = {
    prompt,
    aspectRatio,
    numImages,
    ...(negativePrompt ? { negativePrompt } : {}),
    ...(resolution ? { resolution } : {}),
    ...(refUrls.length > 0 ? { images: refUrls } : {}),
  };

  try {
    const snap = await estimateImageGen(session, input);
    return NextResponse.json({ estimatedBuzz: snap.cost?.total ?? 0 });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json(
        { error: 'orchestrator_error' },
        { status: err.status >= 400 ? err.status : 502 },
      );
    }
    throw err;
  }
}
