import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

/** Resolve after a microtask/timer tick so concurrency can actually overlap. */
const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
  it('never exceeds the concurrency limit', async () => {
    const limit = 3;
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, limit, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick(5);
      inFlight--;
      return item;
    });

    expect(maxInFlight).toBeLessThanOrEqual(limit);
    expect(maxInFlight).toBe(limit); // and it actually saturates the limit
  });

  it('returns results in INPUT order regardless of completion order', async () => {
    const items = [40, 10, 30, 0, 20];
    const results = await mapWithConcurrency(items, 5, async (item) => {
      // Later items finish first, so completion order != input order.
      await tick(item);
      return item * 2;
    });

    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
    expect(values).toEqual([80, 20, 60, 0, 40]);
  });

  it('settles a mix of resolve/reject WITHOUT rejecting (mirrors allSettled)', async () => {
    const items = [0, 1, 2, 3];
    const results = await mapWithConcurrency(items, 2, async (item) => {
      if (item % 2 === 1) throw new Error(`fail ${item}`);
      return item;
    });

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 0 });
    expect(results[1]!.status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 2 });
    expect(results[3]!.status).toBe('rejected');
    if (results[1]!.status === 'rejected') {
      expect((results[1]!.reason as Error).message).toBe('fail 1');
    }
  });

  it('passes the correct index to fn', async () => {
    const items = ['a', 'b', 'c'];
    const seen: Array<[string, number]> = [];
    await mapWithConcurrency(items, 1, async (item, index) => {
      seen.push([item, index]);
      return index;
    });
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('handles an empty input list', async () => {
    const results = await mapWithConcurrency([], 4, async (x: number) => x);
    expect(results).toEqual([]);
  });
});
