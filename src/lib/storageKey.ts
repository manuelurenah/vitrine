/**
 * Ownership check for client-supplied storage keys at asset finalize time.
 *
 * `presignUpload` (lib/s3.ts) only ever issues keys under the caller's own
 * prefix (`<userId>/<uuid>.<ext>`), and server-side mirroring writes under
 * `generated/<userId>/...`. The finalize route receives the key back from the
 * browser, so it MUST re-verify the key belongs to the requesting user before
 * persisting an `assets` row — otherwise a user can register a DB row pointing
 * at another user's object. Pure (no env / no I/O) so it is trivially testable.
 */
export function isOwnedStorageKey(userKey: string, key: string): boolean {
  if (!userKey || !key) return false;
  return key.startsWith(`${userKey}/`) || key.startsWith(`generated/${userKey}/`);
}
