import { NextResponse, type NextRequest } from 'next/server';
import { OrchestratorError, submitGeneration, estimateGenerationCost } from '@/lib/civitai';
import { briefSchema } from '@/lib/briefSchema';
import { buildGenerateInput, PRESETS, type PresetId } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { createCampaign } from '@/lib/campaigns';
import { recordGeneration } from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';

type SubmittedTile = {
  presetId: PresetId;
  workflowId: string;
  prompt: string;
  estimatedCost: number;
};

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

  try {
    const results = await Promise.all(
      brief.presetIds.map(async (id): Promise<SubmittedTile> => {
        const preset = PRESETS[id];
        const input = buildGenerateInput(brief, preset);
        const [estimate, submit] = await Promise.all([
          estimateGenerationCost(session, input),
          submitGeneration(session, input),
        ]);
        return {
          presetId: id,
          workflowId: submit.id,
          prompt: input.prompt,
          estimatedCost: estimate.cost?.total ?? 0,
        };
      }),
    );

    const estimatedBuzz = results.reduce((sum, t) => sum + t.estimatedCost, 0);

    const campaign = await createCampaign({
      userId: userKey,
      title: brief.title,
      brief,
      presetIds: brief.presetIds,
      tiles: results.map((r) => ({ presetId: r.presetId, workflowId: r.workflowId, prompt: r.prompt })),
      estimatedBuzz,
      audience: brief.audience?.trim() || null,
      aesthetics: brief.aesthetics?.trim() || null,
    });

    await Promise.all(
      results.map(async (r) => {
        const tile = campaign.tiles.find((t) => t.workflowId === r.workflowId);
        const input = buildGenerateInput(brief, PRESETS[r.presetId]);
        await recordGeneration({
          workflowId: r.workflowId,
          userId: userKey,
          source: 'campaign',
          sourceId: campaign.id,
          tileId: tile?.id,
          prompt: r.prompt,
          input,
          estimatedBuzz: r.estimatedCost,
        });
        await recordBuzzEvent({
          userId: userKey,
          workflowId: r.workflowId,
          kind: 'estimate',
          estimated: r.estimatedCost,
        });
        await recordBuzzEvent({
          userId: userKey,
          workflowId: r.workflowId,
          kind: 'submit',
          estimated: r.estimatedCost,
        });
      }),
    );

    return NextResponse.json({ campaignId: campaign.id });
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
