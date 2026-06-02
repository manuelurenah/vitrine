import { NextResponse, type NextRequest } from 'next/server';
import {
  estimateImageGen,
  OrchestratorError,
  type VitrineImageGenInput,
} from '@/lib/civitai';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const body = (await req.json()) as Partial<VitrineImageGenInput>;
  if (!body?.prompt || typeof body.prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const input: VitrineImageGenInput = {
    prompt: body.prompt,
    aspectRatio: body.aspectRatio ?? '1:1',
    numImages: body.numImages ?? 1,
    ...(body.negativePrompt ? { negativePrompt: body.negativePrompt } : {}),
    ...(body.images && body.images.length > 0 ? { images: body.images } : {}),
    ...(body.resolution ? { resolution: body.resolution } : {}),
    ...(body.engine ? { engine: body.engine } : {}),
    ...(body.model ? { model: body.model } : {}),
  };

  try {
    const snapshot = await estimateImageGen(session, input);
    return NextResponse.json({
      cost: snapshot.cost?.total ?? 0,
      snapshot,
    });
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
