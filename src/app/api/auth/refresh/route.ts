import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * Re-seals the session cookie when the access token is near/past expiry.
 *
 * The actual refresh happens inside `getSession()` (carry-forward + single-flight),
 * which calls `setSession()`. Unlike an RSC render, a Route Handler can write
 * cookies, so the refreshed tokens actually persist here — this is what fixes the
 * random-logout bug. Pinged by `<SessionKeepAlive />`. Never returns token material.
 */
export async function POST() {
  const session = await getSession();
  return NextResponse.json({ ok: session != null });
}
