import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAsset, softDeleteAsset, updateAsset } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string }>;

const patchSchema = z
  .object({
    collection: z.string().max(60).nullable().optional(),
    tags: z.array(z.string().max(30)).max(10).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const asset = await getAsset(userKey, id);
  if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_patch', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const asset = await updateAsset(userKey, id, parsed.data);
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
