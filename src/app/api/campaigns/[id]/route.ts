import { type NextRequest, NextResponse } from 'next/server';
import { deleteCampaign } from '@/lib/campaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string }>;

export async function DELETE(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const ok = await deleteCampaign(userKey, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
