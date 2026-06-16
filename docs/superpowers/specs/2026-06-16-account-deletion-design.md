# Self-serve account deletion — design

**Date:** 2026-06-16
**Status:** Approved

## Problem

vitrine has no way for a user to delete their own vitrine account. "Sign out"
clears the local cookie; "revoke" kills the Civitai OAuth grant — neither
erases the user's vitrine data. We need a self-serve "delete account" action
that wipes all vitrine-side data (DB rows + object-storage blobs) and, per
product decision, also revokes the Civitai grant.

This is distinct from deleting the user's **Civitai** account, which vitrine
never touches.

## Decisions

- **Also revoke at Civitai.** Delete-account best-effort revokes the OAuth grant
  (access + refresh tokens) so deletion leaves no trace; next login forces fresh
  consent.
- **Confirm by typing username.** Modal requires the user to type their exact
  username before the confirm button enables. Strongest guard for an
  irreversible action.
- **Best-effort blob cleanup.** Per-object delete failures are swallowed; the
  DB cascade + session clear always proceed. A few orphan blobs are acceptable;
  a stuck user is not.

## Architecture

Logic split per the existing `lib/<entity>.ts` + thin-route convention.

### `lib/account.ts` (new)

```ts
deleteAccount(userKey: string): Promise<{ blobsDeleted: number; blobsFailed: number }>
```

1. Select every `assets` row for `userKey` — `bucket` + `storage_key` —
   **including soft-deleted rows** (`deleted_at` is not null). Those blobs still
   exist in storage.
2. For each row, best-effort `deleteObject(bucket, storageKey)` from `lib/s3.ts`,
   tallying `blobsDeleted` / `blobsFailed`. Per-object errors are caught and
   counted, never thrown.
3. `db.delete(users).where(eq(users.id, userKey))`. All user-scoped tables FK to
   `users` with `ON DELETE CASCADE` (`onboarding_state`, `brand_profiles`,
   `products`, `assets`, `campaigns`, `photoshoots`, `generations`,
   `buzz_events`); second-level tables cascade from their parents or `SET NULL`.
   Verified against the live schema — nothing blocks the delete.
4. Return the counts.

The helper does **not** read the session or touch cookies — it is a pure
data-layer operation keyed by `userKey`, so it is unit-testable with mocked
`db` + `deleteObject`.

### `lib/civitai.ts` — extract `revokeSessionGrant(session)`

The best-effort token-revoke logic currently inlined in
`POST /api/auth/revoke` moves into a shared SDK helper:

```ts
revokeSessionGrant(session: Session): Promise<void>
```

Best-effort revokes `access_token` then `refresh_token` (each wrapped, errors
swallowed — a token may already be invalid). Both `/api/auth/revoke` and the new
delete route call it. SDK calls belong in `civitai.ts` per AGENTS.md.

### `POST /api/account/delete` (new route)

1. `getSession()` → `null` ⇒ `401`.
2. `getUserKey(session)` — stable key (also ensures the row exists).
3. `await deleteAccount(userKey)`.
4. `await revokeSessionGrant(session)` — best-effort.
5. `await clearSession()`.
6. `NextResponse.json({ ok: true, blobsDeleted, blobsFailed })`.

### UI — settings `// session` card

- `settings/page.tsx` already resolves `username`; pass it into `SessionActions`.
- New client component `DeleteAccountDialog.tsx`:
  - Danger "delete account" button opens a modal.
  - Modal warns the action is irreversible and lists what is erased: brand,
    products, assets, campaigns, photoshoots, generation history, buzz history.
  - A text input must **exactly match the username**; the confirm button stays
    disabled until it does.
  - On confirm → `POST /api/account/delete` → on `ok`, `window.location.href = '/'`.
  - On failure, surface an inline error and stay on the page (no redirect).
- Revoke + sign out stay in `SessionActions` unchanged.

## Data flow

```
user types username → confirm enabled → POST /api/account/delete
  → getSession (401 if none)
  → getUserKey
  → deleteAccount(userKey): list asset blobs → deleteObject each → DELETE users (cascade)
  → revokeSessionGrant(session) (best-effort)
  → clearSession
  → 200 { ok, blobsDeleted, blobsFailed }
→ client redirects to /  → logged out, onboarding gate re-triggers on next login
```

## Error handling

- **Blob delete failure:** caught per-object, counted in `blobsFailed`, never
  aborts. Returned to the client for visibility/logging.
- **DB cascade failure:** unexpected (schema verified). If `db.delete` throws,
  the route returns `500` and the session is **not** cleared, so the user can
  retry. Document this ordering: blobs first, then DB delete, then revoke, then
  clearSession — clearSession is last so a mid-flow throw leaves the user logged
  in and able to retry.
- **Revoke failure:** swallowed (best-effort, same as today's revoke route).
- **No session:** `401`; the client never reaches the modal without a session,
  but the route guards anyway.
- **Username mismatch:** purely client-side gate; the button cannot fire the
  request until the input matches.

## Testing

- **Unit — `src/lib/account.test.ts` (vitest, co-located per project pattern):**
  - Lists and deletes a blob per asset row, including soft-deleted rows.
  - Deletes the `users` row exactly once with the right key.
  - Swallows a `deleteObject` rejection and reports it in `blobsFailed` while
    still deleting the user.
  - Returns correct `blobsDeleted` / `blobsFailed` counts.
  - `db` and `deleteObject` are mocked.
- **E2E — extend the settings spec (Playwright, isolated test DB):**
  - Delete button opens the modal; confirm is disabled until the exact username
    is typed.
  - Typing the username enables confirm; confirming redirects to `/` (logged
    out). Runs against the isolated `vitrine_test` DB so destroying the test
    user is safe.

## Out of scope

- Deleting the user's Civitai account (vitrine never touches it).
- Async/queued blob purge or storage GC for already-orphaned blobs.
- Admin-initiated deletion or data-export-before-delete (GDPR portability).
- A grace period / soft-delete-then-purge for the account itself.
