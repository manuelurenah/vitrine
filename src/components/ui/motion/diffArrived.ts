/**
 * Ids present in `current` but not yet in `seen`, in `current` order.
 * Used to fire an entrance animation exactly once per item across the repeated
 * re-renders of a long-polling surface.
 */
export function diffArrived(seen: ReadonlySet<string>, current: readonly string[]): string[] {
  return current.filter((id) => !seen.has(id));
}
