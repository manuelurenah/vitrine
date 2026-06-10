import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type OnboardingPayload, patchOnboardingPayload } from '@/lib/onboarding';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEX_RE = /^#[0-9a-f]{6}$/i;

const bodySchema = z.object({
  brandName: z.string().max(120).optional(),
  websiteUrl: z.string().max(2048).optional(),
  description: z.string().max(4000).optional(),
  colors: z.array(z.string().regex(HEX_RE)).max(24).optional(),
  logoName: z.string().max(200).nullable().optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
  tagline: z.string().max(280).optional(),
  tone: z.array(z.string().min(1).max(60)).max(24).optional(),
  font: z.string().max(80).optional(),
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch: OnboardingPayload = {};
  if (parsed.data.brandName !== undefined) patch.brandName = parsed.data.brandName;
  if (parsed.data.websiteUrl !== undefined) patch.websiteUrl = parsed.data.websiteUrl;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.colors !== undefined) {
    patch.colors = parsed.data.colors.map((c) => c.toLowerCase());
  }
  if (parsed.data.logoName !== undefined) {
    patch.logoName = parsed.data.logoName ?? undefined;
  }
  if (parsed.data.logoUrl !== undefined) {
    patch.logoUrl = parsed.data.logoUrl ?? undefined;
  }
  if (parsed.data.tagline !== undefined) patch.tagline = parsed.data.tagline;
  if (parsed.data.tone !== undefined) patch.tone = parsed.data.tone;
  if (parsed.data.font !== undefined) patch.font = parsed.data.font;

  const userKey = await getUserKey(session);
  const snapshot = await patchOnboardingPayload(userKey, patch);
  return NextResponse.json({ payload: snapshot.payload });
}
