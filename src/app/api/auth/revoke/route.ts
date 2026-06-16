import { NextResponse } from 'next/server';
import { revokeSessionGrant } from '@/lib/civitai';
import { clearSession, getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  // Best-effort revoke at Civitai — we still clear our own cookie either way.
  if (session) await revokeSessionGrant(session);
  await clearSession();
  return NextResponse.json({ ok: true });
}
