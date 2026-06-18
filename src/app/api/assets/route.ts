import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAsset, listAssets } from '@/lib/assets';
import { bucketFor, publicUrlFor } from '@/lib/s3';
import { getSession } from '@/lib/session';
import { isOwnedStorageKey } from '@/lib/storageKey';
import { getUserKey } from '@/lib/userKey';

const finalizeSchema = z.object({
  bucket: z.string().min(1).max(120),
  key: z.string().min(1).max(500),
  // `publicUrl` from the client is intentionally NOT accepted — it is derived
  // server-side from the validated bucket+key (see POST handler).
  contentType: z.string().max(120).optional(),
  byteSize: z
    .number()
    .int()
    .nonnegative()
    .max(50 * 1024 * 1024)
    .optional(),
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

  // Re-verify the client-supplied storage pointer server-side. The browser
  // could otherwise register a DB row pointing at another user's object or at
  // an arbitrary URL. Allowed buckets are our own upload/asset buckets, the
  // key must live under this user's prefix, and the public URL is DERIVED
  // server-side (the client's `publicUrl` is ignored — it could be a
  // `javascript:`/`data:` payload that later renders as a link).
  const allowedBuckets = new Set([bucketFor('upload'), bucketFor('asset')]);
  if (!allowedBuckets.has(data.bucket) || !isOwnedStorageKey(userKey, data.key)) {
    return NextResponse.json({ error: 'invalid_storage_ref' }, { status: 400 });
  }
  const publicUrl = publicUrlFor(data.bucket, data.key);

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
      publicUrl,
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
    console.error('asset finalize failed', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
