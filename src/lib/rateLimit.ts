import 'server-only';
import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

/**
 * Postgres-backed fixed-window rate limiter. Backed by the `rate_limits` table
 * (one row per key), updated with a single atomic upsert so it is correct
 * across concurrent requests and multiple app instances. Chosen over Redis to
 * avoid a new runtime dependency — `DATABASE_URL` is always present, so no
 * separate cache service is needed.
 *
 * Fails OPEN: if the DB check errors, the request is allowed (rate limiting is
 * a guard rail, not a correctness gate — it must never take the app down).
 */
export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Pure mapping from a stored counter row to a decision. Exported for testing. */
export function interpretRateLimitRow(opts: {
  count: number;
  windowStartEpoch: number;
  limit: number;
  windowSeconds: number;
  nowMs: number;
}): RateLimitResult {
  const { count, windowStartEpoch, limit, windowSeconds, nowMs } = opts;
  const ok = count <= limit;
  const remaining = Math.max(0, limit - count);
  if (ok) return { ok, remaining, retryAfterSeconds: 0 };
  const windowEnd = windowStartEpoch + windowSeconds;
  const retryAfterSeconds = Math.max(1, Math.ceil(windowEnd - nowMs / 1000));
  return { ok, remaining, retryAfterSeconds };
}

/**
 * Increment the counter for `key` within the current window and decide whether
 * the request is allowed. `limit` is the max requests per `windowSeconds`.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    // Lazy import: keeps this module loadable in unit tests (which don't load
    // the DB / validated env) so the pure helpers above can be tested directly.
    const { db } = await import('@/lib/db');
    const result = await db.execute(sql`
      INSERT INTO rate_limits ("key", "window_start", "count")
      VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN rate_limits."window_start" < now() - make_interval(secs => ${windowSeconds})
          THEN 1 ELSE rate_limits."count" + 1 END,
        "window_start" = CASE
          WHEN rate_limits."window_start" < now() - make_interval(secs => ${windowSeconds})
          THEN now() ELSE rate_limits."window_start" END
      RETURNING "count", extract(epoch from "window_start") AS window_start_epoch
    `);
    const rows = (result as { rows?: unknown[] }).rows ?? [];
    const row = rows[0] as { count: number | string; window_start_epoch: number | string } | undefined;
    if (!row) return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    return interpretRateLimitRow({
      count: Number(row.count),
      windowStartEpoch: Number(row.window_start_epoch),
      limit,
      windowSeconds,
      nowMs: Date.now(),
    });
  } catch (err) {
    console.error('rate limit check failed — allowing request (fail open)', err);
    return { ok: true, remaining: 0, retryAfterSeconds: 0 };
  }
}

/**
 * Best-effort client IP for pre-auth keying (e.g. login). Trusts the proxy's
 * forwarding headers — staging/prod sit behind a known proxy.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
