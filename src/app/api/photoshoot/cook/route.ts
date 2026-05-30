import { NextResponse, type NextRequest } from 'next/server';
import { estimateGenerationCost, OrchestratorError, submitGeneration } from '@/lib/civitai';
import { photoshootBriefSchema } from '@/lib/photoshootSchema';
import {
  buildPhotoshootInput,
  PHOTOSHOOT_TEMPLATES,
  type PhotoshootTemplateId,
} from '@/lib/photoshootTemplates';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { createPhotoshoot } from '@/lib/photoshoots';
import { recordGeneration } from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';

type SubmittedTile = {
  templateId: PhotoshootTemplateId;
  variantIndex: number;
  workflowId: string;
  prompt: string;
  estimatedCost: number;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = photoshootBriefSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_brief', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const brief = parsed.data;
  const userKey = await getUserKey(session);

  try {
    const submissions: Array<Promise<SubmittedTile>> = [];
    for (const templateId of brief.templateIds) {
      const template = PHOTOSHOOT_TEMPLATES[templateId];
      for (let v = 0; v < brief.variantsPerTemplate; v++) {
        const input = buildPhotoshootInput(brief, template);
        submissions.push(
          (async () => {
            const [estimate, submit] = await Promise.all([
              estimateGenerationCost(session, input),
              submitGeneration(session, input),
            ]);
            return {
              templateId,
              variantIndex: v,
              workflowId: submit.id,
              prompt: input.prompt,
              estimatedCost: estimate.cost?.total ?? 0,
            };
          })(),
        );
      }
    }

    const results = await Promise.all(submissions);
    const estimatedBuzz = results.reduce((sum, t) => sum + t.estimatedCost, 0);

    const shoot = await createPhotoshoot({
      userId: userKey,
      title: brief.productName,
      brief,
      tiles: results.map((r) => ({
        templateId: r.templateId,
        variantIndex: r.variantIndex,
        workflowId: r.workflowId,
        prompt: r.prompt,
      })),
      estimatedBuzz,
    });

    await Promise.all(
      results.map(async (r) => {
        const tile = shoot.tiles.find((t) => t.workflowId === r.workflowId);
        const input = buildPhotoshootInput(brief, PHOTOSHOOT_TEMPLATES[r.templateId]);
        await recordGeneration({
          workflowId: r.workflowId,
          userId: userKey,
          source: 'photoshoot',
          sourceId: shoot.id,
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

    return NextResponse.json({ photoshootId: shoot.id });
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
