import { NextResponse, type NextRequest } from 'next/server';
import {
  estimateImageGen,
  OrchestratorError,
  type VitrineImageGenInput,
} from '@/lib/civitai';
import { briefSchema } from '@/lib/briefSchema';
import { PRESETS } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getDefaultBrand } from '@/lib/brand';
import { buildCampaignPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = briefSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_brief', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const brief = parsed.data;
  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  try {
    const tiles = await Promise.all(
      brief.presetIds.map(async (id) => {
        const preset = PRESETS[id];
        const enhanced = buildCampaignPrompt({ brief, brand, preset });
        const input: VitrineImageGenInput = {
          prompt: resolveFinalPrompt(enhanced),
          aspectRatio: enhanced.aspectRatio,
          numImages: 1,
          ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
        };
        const snap = await estimateImageGen(session, input);
        return {
          presetId: id,
          label: preset.label,
          cost: snap.cost?.total ?? 0,
        };
      }),
    );
    const total = tiles.reduce((sum, t) => sum + t.cost, 0);
    return NextResponse.json({ tiles, total });
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
