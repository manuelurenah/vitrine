import { NextResponse, type NextRequest } from 'next/server';
import { OrchestratorError, submitGeneration } from '@/lib/civitai';
import { getCampaign, swapTileWorkflow } from '@/lib/campaigns';
import { buildGenerateInput, PRESETS } from '@/lib/presets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { recordGeneration } from '@/lib/generations';
import { recordBuzzEvent } from '@/lib/buzz';

type Params = Promise<{ id: string; tileId: string }>;

export async function POST(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;
  const campaign = await getCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const preset = PRESETS[tile.presetId];
  const input = buildGenerateInput(
    {
      ...campaign.brief,
      // Re-seed with a small twist so the orchestrator returns a different
      // result rather than the cached one.
      prompt: `${campaign.brief.prompt} · variation ${Math.floor(Math.random() * 1000)}`,
    },
    preset,
  );

  try {
    const snap = await submitGeneration(session, input);
    const updated = await swapTileWorkflow(userKey, id, tileId, snap.id);
    await recordGeneration({
      workflowId: snap.id,
      userId: userKey,
      source: 'campaign',
      sourceId: id,
      tileId,
      prompt: input.prompt,
      input,
      estimatedBuzz: snap.cost?.total ?? 0,
    });
    await recordBuzzEvent({
      userId: userKey,
      workflowId: snap.id,
      kind: 'submit',
      estimated: snap.cost?.total ?? 0,
      note: 'regenerate',
    });
    return NextResponse.json({ tile: updated, workflowId: snap.id });
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
