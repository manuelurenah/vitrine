/**
 * Run `fn` over `items` with at most `limit` calls in flight at once.
 *
 * Mirrors `Promise.allSettled` semantics: the returned promise never rejects,
 * and results are returned in INPUT ORDER (not completion order) as
 * `PromiseSettledResult`s. Callers can partition fulfilled vs rejected exactly
 * as they would with `Promise.allSettled`, while capping the number of
 * concurrent operations to avoid hammering an upstream service.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  // Guard against degenerate limits so we never stall (limit <= 0) or spin past
  // the work available.
  const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        const value = await fn(items[index]!, index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < effectiveLimit; i++) workers.push(worker());
  await Promise.all(workers);

  return results;
}
