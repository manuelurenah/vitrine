import { NextResponse, type NextRequest } from 'next/server';
import { getBrand, updateBrand } from '@/lib/brand';
import { brandUpdateSchema } from '@/lib/brandSchema';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string }>;

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;
  const brand = await getBrand(userKey, id);
  if (!brand) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = brandUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_patch', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const brand = await updateBrand(userKey, id, parsed.data);
  if (!brand) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ brand });
}
