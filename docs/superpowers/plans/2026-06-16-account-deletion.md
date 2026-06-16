# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-serve "delete account" action to the settings page that erases all vitrine data (DB rows + storage blobs), revokes the Civitai grant, and logs the user out.

**Architecture:** A pure `purgeBlobs` helper (unit-tested) plus a `deleteAccount(userKey)` orchestrator in `lib/account.ts`; a shared `revokeSessionGrant(session)` extracted into `lib/civitai.ts`; a thin `POST /api/account/delete` route; and a `DeleteAccountDialog` client component with a username-typed confirm, mounted in the settings session card. The user row delete relies on the existing `ON DELETE CASCADE` FKs.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (Postgres), `@civitai/app-sdk`, AWS S3 SDK (`lib/s3.ts`), Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-16-account-deletion-design.md`

---

## File Structure

- **Create** `src/lib/account.ts` — `purgeBlobs` (pure) + `deleteAccount(userKey)`.
- **Create** `src/lib/account.test.ts` — vitest unit test for `purgeBlobs`.
- **Modify** `src/lib/civitai.ts` — add `revokeSessionGrant(session)` SDK helper.
- **Modify** `src/app/api/auth/revoke/route.ts` — use `revokeSessionGrant`.
- **Create** `src/app/api/account/delete/route.ts` — the delete endpoint.
- **Create** `src/components/settings/DeleteAccountDialog.tsx` — confirm modal + button.
- **Modify** `src/app/(app)/settings/page.tsx` — mount `DeleteAccountDialog` with `username`.
- **Create** `e2e/45-account-delete.spec.ts` — UI gate + full delete + redirect.

---

### Task 1: `purgeBlobs` pure helper (TDD)

**Files:**
- Create: `src/lib/account.ts`
- Test: `src/lib/account.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/account.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { purgeBlobs } from './account';

describe('purgeBlobs', () => {
  it('deletes every blob and counts successes', async () => {
    const deleter = vi.fn().mockResolvedValue(undefined);
    const blobs = [
      { bucket: 'assets', storageKey: 'u/1.png' },
      { bucket: 'uploads', storageKey: 'u/2.png' },
    ];

    const counts = await purgeBlobs(blobs, deleter);

    expect(deleter).toHaveBeenCalledTimes(2);
    expect(deleter).toHaveBeenCalledWith('assets', 'u/1.png');
    expect(deleter).toHaveBeenCalledWith('uploads', 'u/2.png');
    expect(counts).toEqual({ blobsDeleted: 2, blobsFailed: 0 });
  });

  it('swallows per-blob failures and tallies them', async () => {
    const deleter = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('s3 down'))
      .mockResolvedValueOnce(undefined);
    const blobs = [
      { bucket: 'assets', storageKey: 'a' },
      { bucket: 'assets', storageKey: 'b' },
      { bucket: 'assets', storageKey: 'c' },
    ];

    const counts = await purgeBlobs(blobs, deleter);

    expect(deleter).toHaveBeenCalledTimes(3);
    expect(counts).toEqual({ blobsDeleted: 2, blobsFailed: 1 });
  });

  it('returns zero counts for an empty list', async () => {
    const deleter = vi.fn();
    const counts = await purgeBlobs([], deleter);
    expect(deleter).not.toHaveBeenCalled();
    expect(counts).toEqual({ blobsDeleted: 0, blobsFailed: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/lib/account.test.ts`
Expected: FAIL — `purgeBlobs` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/account.ts`:

```ts
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assets, users } from '@/lib/db/schema';
import { deleteObject } from '@/lib/s3';

export type StoredBlob = { bucket: string; storageKey: string };

export type DeleteAccountResult = { blobsDeleted: number; blobsFailed: number };

/**
 * Best-effort delete each blob via the injected `deleter`. Per-object failures
 * are swallowed and tallied — never thrown — so a flaky storage backend can't
 * strand a user mid-deletion. Injecting the deleter keeps this unit-testable.
 */
export async function purgeBlobs(
  blobs: StoredBlob[],
  deleter: (bucket: string, key: string) => Promise<void>,
): Promise<DeleteAccountResult> {
  let blobsDeleted = 0;
  let blobsFailed = 0;
  for (const blob of blobs) {
    try {
      await deleter(blob.bucket, blob.storageKey);
      blobsDeleted += 1;
    } catch {
      blobsFailed += 1;
    }
  }
  return { blobsDeleted, blobsFailed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/lib/account.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/account.ts src/lib/account.test.ts
git commit -m "feat(account): add purgeBlobs best-effort blob deleter"
```

---

### Task 2: `deleteAccount(userKey)` orchestrator

**Files:**
- Modify: `src/lib/account.ts`

No unit test — this is thin DB wiring (drizzle select + cascade delete) covered by the e2e in Task 6. Mocking drizzle's query builder would test the mock, not the behavior.

- [ ] **Step 1: Append `deleteAccount` to `src/lib/account.ts`**

Add below `purgeBlobs`:

```ts
/**
 * Erase all vitrine data for `userKey`: first delete every object-storage blob
 * the user owns (including soft-deleted asset rows — those blobs still exist),
 * then delete the `users` row. All user-scoped tables FK to `users` with
 * ON DELETE CASCADE (second-level tables cascade from their parents or SET
 * NULL), so the single delete tears down everything. Does not touch the session
 * or the Civitai grant — the route handles those.
 */
export async function deleteAccount(userKey: string): Promise<DeleteAccountResult> {
  const blobs = await db
    .select({ bucket: assets.bucket, storageKey: assets.storageKey })
    .from(assets)
    .where(eq(assets.userId, userKey));

  const counts = await purgeBlobs(blobs, deleteObject);

  await db.delete(users).where(eq(users.id, userKey));

  return counts;
}
```

Note: the `where` deliberately filters on `userId` only — NOT `isNull(assets.deletedAt)` — so soft-deleted assets' blobs are purged too.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/account.ts
git commit -m "feat(account): add deleteAccount cascade + blob purge"
```

---

### Task 3: Extract `revokeSessionGrant` into `lib/civitai.ts`

**Files:**
- Modify: `src/lib/civitai.ts`
- Modify: `src/app/api/auth/revoke/route.ts`

- [ ] **Step 1: Add `revokeToken` to the SDK import in `src/lib/civitai.ts`**

The file imports SDK members in a block starting at line 3 (`import { ... } from '@civitai/app-sdk';`) — but verify the exact import lines first. `fetchMe` is imported on line 2. Add `revokeToken` to whichever `@civitai/app-sdk` import block exists. If only the `fetchMe` single import exists, change line 2 from:

```ts
import { fetchMe } from '@civitai/app-sdk';
```
to:
```ts
import { fetchMe, revokeToken } from '@civitai/app-sdk';
```

(`env` and `type Session` are already imported in this file — lines 13–14.)

- [ ] **Step 2: Append `revokeSessionGrant` to `src/lib/civitai.ts`**

Add at the end of the file:

```ts
/**
 * Best-effort revoke of the session's OAuth grant at Civitai. Revokes the
 * access token then the refresh token; each is wrapped because either may
 * already be invalid. Never throws — callers always proceed to clear the
 * local session regardless.
 */
export async function revokeSessionGrant(session: Session): Promise<void> {
  const tryRevoke = async (token: string) => {
    try {
      await revokeToken({
        baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL,
        clientId: env.CIVITAI_CLIENT_ID,
        clientSecret: env.CIVITAI_CLIENT_SECRET,
        token,
      });
    } catch {
      // Best-effort — token may already be invalid.
    }
  };
  if (session.tokens.access_token) await tryRevoke(session.tokens.access_token);
  if (session.tokens.refresh_token) await tryRevoke(session.tokens.refresh_token);
}
```

- [ ] **Step 3: Rewrite `src/app/api/auth/revoke/route.ts` to use it**

Replace the whole file with:

```ts
import { NextResponse } from 'next/server';
import { revokeSessionGrant } from '@/lib/civitai';
import { clearSession, getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  // Best-effort revoke at Civitai — we still clear our own cookie either way.
  if (session) await revokeSessionGrant(session);
  await clearSession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (`env` no longer imported in the revoke route — confirm no unused-import lint error there.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/civitai.ts src/app/api/auth/revoke/route.ts
git commit -m "refactor(auth): extract revokeSessionGrant SDK helper"
```

---

### Task 4: `POST /api/account/delete` route

**Files:**
- Create: `src/app/api/account/delete/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { deleteAccount } from '@/lib/account';
import { revokeSessionGrant } from '@/lib/civitai';
import { clearSession, getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userKey = await getUserKey(session);

  // Order matters: blobs + DB rows first, then revoke, then clear the cookie
  // last so a mid-flow throw leaves the user logged in and able to retry.
  const counts = await deleteAccount(userKey);
  await revokeSessionGrant(session);
  await clearSession();

  return NextResponse.json({ ok: true, ...counts });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/account/delete/route.ts
git commit -m "feat(account): add POST /api/account/delete route"
```

---

### Task 5: `DeleteAccountDialog` component + settings wiring

**Files:**
- Create: `src/components/settings/DeleteAccountDialog.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create `src/components/settings/DeleteAccountDialog.tsx`**

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, FieldLabel, Input, Modal } from '@/components/ui';

export function DeleteAccountDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmText.trim() === username;

  function reset() {
    setConfirmText('');
    setError(null);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function confirmDelete() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed');
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
        className="text-danger hover:text-danger"
        data-testid="delete-account-open"
      >
        delete account
      </Button>

      <Modal
        open={open}
        onClose={close}
        eyebrow="// danger"
        title="delete vitrine account"
        maxWidth={460}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmDelete}
              disabled={!matches || busy}
              className="bg-danger text-white hover:bg-danger hover:brightness-110 disabled:bg-bg-3 disabled:text-fg-3"
              data-testid="delete-account-confirm"
            >
              {busy ? 'deleting…' : 'delete account'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-[1.5] text-fg-1">
            This permanently erases your vitrine brand, products, assets, campaigns,
            photoshoots, generation history, and buzz history, and revokes vitrine&apos;s
            access at Civitai. Your Civitai account is not affected. This cannot be undone.
          </p>
          <div>
            <FieldLabel htmlFor="confirm-username">
              type{' '}
              <span className="text-fg-0" data-testid="delete-account-username">
                {username}
              </span>{' '}
              to confirm
            </FieldLabel>
            <Input
              id="confirm-username"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-testid="delete-account-input"
            />
          </div>
          {error && (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Mount it in the settings session card**

In `src/app/(app)/settings/page.tsx`, add the import near the other component import:

```tsx
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
```

Then update the session `Card` body. Find:

```tsx
      <Card title="session" tone="danger">
        <p className="mb-3 text-[12.5px] text-fg-2">
          sign out clears your local cookie. revoke also invalidates tokens at Civitai.
        </p>
        <SessionActions />
      </Card>
```

Replace with:

```tsx
      <Card title="session" tone="danger">
        <p className="mb-3 text-[12.5px] text-fg-2">
          sign out clears your local cookie. revoke also invalidates tokens at Civitai.
          deleting your account erases all vitrine data and revokes the grant.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SessionActions />
          <DeleteAccountDialog username={username} />
        </div>
      </Card>
```

(`username` is already in scope in this component — see line ~39.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/DeleteAccountDialog.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat(account): delete-account confirm dialog in settings"
```

---

### Task 6: E2E coverage

**Files:**
- Create: `e2e/45-account-delete.spec.ts`

This spec runs against the isolated `vitrine_test` DB. Deleting the test user is safe: every spec's `beforeEach` calls `markOnboardingComplete()`, which upserts the `users` row back before the next test.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import { countRows, markOnboardingComplete, resetUserData, seedAsset, testUserId } from './helpers/db';

test.describe('account deletion', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('confirm button gates on exact username', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/settings`);

    await page.getByTestId('delete-account-open').click();

    const confirm = page.getByTestId('delete-account-confirm');
    await expect(confirm).toBeDisabled();

    const username = (await page.getByTestId('delete-account-username').textContent())?.trim() ?? '';
    expect(username.length).toBeGreaterThan(0);

    await page.getByTestId('delete-account-input').fill('not-the-username');
    await expect(confirm).toBeDisabled();

    await page.getByTestId('delete-account-input').fill(username);
    await expect(confirm).toBeEnabled();
  });

  test('deletes the account and logs the user out', async ({ page, baseURL }) => {
    await seedAsset({ kind: 'upload' });
    expect(await countRows('assets')).toBe(1);

    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/settings`);

    await page.getByTestId('delete-account-open').click();
    const username = (await page.getByTestId('delete-account-username').textContent())?.trim() ?? '';
    await page.getByTestId('delete-account-input').fill(username);
    await page.getByTestId('delete-account-confirm').click();

    // Redirected to the logged-out root.
    await expect(page).toHaveURL(`${baseURL}/`, { timeout: 15_000 });

    // All vitrine data for the user is gone.
    expect(await countRows('assets', testUserId)).toBe(0);
    expect(await countRows('onboarding_state', testUserId)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm test:e2e e2e/45-account-delete.spec.ts`
Expected: PASS (2 tests). If the suite needs the test DB synced first, run `pnpm test:db:setup` once.

- [ ] **Step 3: Commit**

```bash
git add e2e/45-account-delete.spec.ts
git commit -m "test(account): e2e for delete-account gate + flow"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full typecheck + unit tests**

Run: `pnpm typecheck && pnpm test:unit`
Expected: typecheck clean; all unit tests pass (incl. `account.test.ts`).

- [ ] **Step 2: Lint (if configured)**

Run: `pnpm lint`
Expected: no new errors in touched files. Fix any unused-import warnings (e.g. the old `env` import removed from the revoke route).

- [ ] **Step 3: Confirm clean tree**

Run: `git status`
Expected: nothing uncommitted from this work.
