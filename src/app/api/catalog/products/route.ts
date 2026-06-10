import { type NextRequest, NextResponse } from 'next/server';
import { createProduct, listProducts } from '@/lib/catalog';
import { productCreateSchema } from '@/lib/catalogSchema';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const products = await listProducts(userKey);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const parsed = productCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_product', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const userKey = await getUserKey(session);
  const product = await createProduct({ userId: userKey, ...parsed.data });
  return NextResponse.json({ product }, { status: 201 });
}
