import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { presignUpload } from '@/lib/s3';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — matches "up to 20 mb each" in design

const presignSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120).default('application/octet-stream'),
  byteSize: z.number().int().nonnegative().max(MAX_BYTES),
  bucketKind: z.enum(['upload', 'asset']).default('asset'),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userKey = await getUserKey(session);
  try {
    const upload = await presignUpload({
      userId: userKey,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      bucketKind: parsed.data.bucketKind,
    });
    return NextResponse.json(upload);
  } catch (err) {
    return NextResponse.json(
      { error: 'presign_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
