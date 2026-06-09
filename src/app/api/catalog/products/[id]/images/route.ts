import { NextResponse, type NextRequest } from 'next/server';
import { appendProductImages } from '@/lib/catalog';
import { productImagesAppendSchema } from '@/lib/catalogSchema';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const parsed = productImagesAppendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const userKey = await getUserKey(session);
  const { id } = await params;
  const result = await appendProductImages({
    userId: userKey,
    productId: id,
    assetIds: parsed.data.assetIds,
  });
  if (!result) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  }
  return NextResponse.json(
    { product: result.product, addedCount: result.addedCount, skippedCount: result.skippedCount },
    { status: 200 },
  );
}
