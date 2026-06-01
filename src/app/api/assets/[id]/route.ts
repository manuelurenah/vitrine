import { NextResponse, type NextRequest } from 'next/server';
import { getAsset, softDeleteAsset } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string }>;

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const asset = await getAsset(userKey, id);
  if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function DELETE(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const ok = await softDeleteAsset(userKey, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
