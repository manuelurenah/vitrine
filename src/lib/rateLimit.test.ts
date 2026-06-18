import { describe, expect, it } from 'vitest';
import { interpretRateLimitRow } from './rateLimit';

describe('interpretRateLimitRow', () => {
  const base = { limit: 10, windowSeconds: 60, nowMs: 1_010_000 };

  it('allows when count is at or below the limit', () => {
    const r = interpretRateLimitRow({ ...base, count: 1, windowStartEpoch: 1000 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.retryAfterSeconds).toBe(0);
  });

  it('allows on the exact limit (count === limit)', () => {
    const r = interpretRateLimitRow({ ...base, count: 10, windowStartEpoch: 1000 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('blocks once count exceeds the limit and reports retry-after to window end', () => {
    // window started at epoch 1000s, 60s window → ends at 1060s; now is 1010s.
    const r = interpretRateLimitRow({ ...base, count: 11, windowStartEpoch: 1000 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSeconds).toBe(50);
  });

  it('never reports a retry-after below 1 second when blocked', () => {
    // now is past the window end → clamp to 1s rather than 0/negative.
    const r = interpretRateLimitRow({ ...base, count: 11, windowStartEpoch: 900 });
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(1);
  });
});
