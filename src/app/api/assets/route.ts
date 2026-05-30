import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { createAsset, listAssets } from '@/lib/assets';

const finalizeSchema = z.object({
  bucket: z.string().min(1).max(120),
  key: z.string().min(1).max(500),
  publicUrl: z.string().url().optional(),
  contentType: z.string().max(120).optional(),
  byteSize: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  kind: z.enum(['upload', 'generated', 'reference']).default('upload'),
  brandId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  collection: z.string().max(60).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  description: z.string().max(2000).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const assets = await listAssets(userKey, 200);
  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = finalizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userKey = await getUserKey(session);
  const data = parsed.data;
  const metadata: Record<string, unknown> = {};
  if (data.collection) metadata.collection = data.collection;
  if (data.tags && data.tags.length) metadata.tags = data.tags;
  if (data.description) metadata.description = data.description;

  try {
    const asset = await createAsset({
      userId: userKey,
      kind: data.kind,
      bucket: data.bucket,
      storageKey: data.key,
      publicUrl: data.publicUrl ?? null,
      contentType: data.contentType ?? null,
      byteSize: data.byteSize ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      brandId: data.brandId ?? null,
      productId: data.productId ?? null,
      metadata,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'create_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
