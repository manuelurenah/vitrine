import 'server-only';
import { NextResponse } from 'next/server';
import { checkRateLimit } from './rateLimit';

/**
 * Route-handler convenience: check a rate-limit key and, if exceeded, return a
 * ready-to-send 429 with a `Retry-After` header. Returns `null` when allowed,
 * so callers do:
 *
 *   const limited = await rateLimitOr429(`cook:${userKey}`, 10, 60);
 *   if (limited) return limited;
 */
export async function rateLimitOr429(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const r = await checkRateLimit(key, limit, windowSeconds);
  if (r.ok) return null;
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'retry-after': String(r.retryAfterSeconds) } },
  );
}
