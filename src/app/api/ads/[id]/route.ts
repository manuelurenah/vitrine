import { type NextRequest, NextResponse } from 'next/server';
import { deleteAdCampaign } from '@/lib/adCampaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string }>;

export async function DELETE(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  await deleteAdCampaign(userKey, id);
  return NextResponse.json({ ok: true });
}
