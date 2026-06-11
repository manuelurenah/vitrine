import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTileFields } from '@/lib/campaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const patchSchema = z.object({
  adCopy: z
    .object({
      headline: z.string().min(1),
      subhead: z.string().min(1),
      cta: z.string().optional(),
    })
    .optional(),
  prompt: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!parsed.data.adCopy && !parsed.data.prompt) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const tile = await updateTileFields(userKey, id, tileId, parsed.data);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  return NextResponse.json({ tile });
}
