/**
 * Decide whether an inline-edit draft should be persisted.
 *
 * Trims the draft, then:
 * - returns `commit: false` (a no-op) when the trimmed value matches `current`,
 * - reverts an empty draft to `current` unless `allowEmpty` is set,
 * - otherwise commits the trimmed value.
 *
 * Internal whitespace/newlines are preserved (only the ends are trimmed), so it
 * works for both single-line titles and multiline text.
 */
export function resolveCommit(
  draft: string,
  current: string,
  opts: { allowEmpty?: boolean } = {},
): { commit: boolean; value: string } {
  const trimmed = draft.trim();
  if (trimmed === current) return { commit: false, value: current };
  if (trimmed === '' && !opts.allowEmpty) return { commit: false, value: current };
  return { commit: true, value: trimmed };
}
