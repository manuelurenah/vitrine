import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listTileVersions } from '@/lib/tileVersions';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

export async function GET(_req: Request, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const versions = await listTileVersions(userKey, id, tileId);
  return NextResponse.json({ versions });
}
