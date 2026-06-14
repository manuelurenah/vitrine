# Edit Campaign & Photoshoot Details — Design

**Date:** 2026-06-14
**Status:** Approved

## Problem

No way to edit a campaign or photoshoot after creation. Users want to fix the
title (and, for campaigns, the description) without re-cooking.

## Scope

Editable:

- **Campaign:** `title` (column) and `description` (stored in `brief` jsonb).
- **Photoshoot:** `title` (column) only.

Out of scope (these drive cooking / generation):

- Presets, photoshoot templates, ratio, variants-per-preset/template.
- Reference assets, audience, aesthetics, goal, product link, productNotes.

## UX

Inline edit on the existing detail pages — no new routes, no modal.

- Click the title (or campaign description) → it becomes an editable field.
- `Enter` (single-line title) or blur → save. `Esc` → cancel, revert.
- Empty title is rejected (revert to previous value, no request sent).
- Campaign description is always editable; when empty it shows a muted
  "Add a description" affordance so it can be filled in.
- While saving the field is disabled; on error it reverts and logs.
- After a successful save, call `router.refresh()` so the server re-renders
  (keeps breadcrumb + `<h1>` in sync with the new value).

## Components

### `InlineEditText` (new, client, `src/components/ui`)

Reusable inline-edit primitive. Single purpose: render text that can be edited
in place.

Props:

- `value: string` — current text.
- `onSave: (next: string) => Promise<void>` — persists; may throw.
- `multiline?: boolean` — `<textarea>` vs `<input>` (default false).
- `placeholder?: string` — shown when value is empty (muted affordance).
- `ariaLabel: string`
- `className?: string` — typography classes for the rendered text/field.
- `allowEmpty?: boolean` — when false (default for title), empty input reverts
  instead of saving.

Behavior: local `editing` + `draft` state; `saving` disables the field; on
error revert `draft` to `value` and `console.error`. Single-line commits on
`Enter`; multiline commits on blur (Enter inserts newline). `Esc` cancels.

### `CampaignHeaderEditable` (new, client, `src/components/campaigns`)

`CampaignDetail` is a server component. Extract the editable `<h1>` title and
the description `<p>` into this client component.

Props: `campaignId: string`, `initialTitle: string`, `initialDescription: string`.

Renders two `InlineEditText` instances (title non-empty, description allows
empty + placeholder). Each `onSave` PATCHes `/api/campaigns/{id}` then
`router.refresh()`. The read-only eyebrow (`goal`, creative count) stays in
`CampaignDetail`.

### `PhotoshootResults` (existing, already client)

Replace the title `<h1>` with `InlineEditText` (title only). `onSave` PATCHes
`/api/photoshoot/{id}` then `router.refresh()`. No description field added.

## Data layer

### `src/lib/campaigns.ts`

```ts
export async function updateCampaign(
  userId: string,
  id: string,
  patch: { title?: string; description?: string },
): Promise<Campaign | null>
```

- Ownership-scoped load (`id` + `userId`); return `null` if not found.
- If `title` present, set the `title` column.
- If `description` present, read the current `brief`, merge
  `{ ...brief, description }`, write back the whole jsonb.
- Bump `updatedAt`. Return the reloaded `Campaign`.

### `src/lib/photoshoots.ts`

```ts
export async function updatePhotoshoot(
  userId: string,
  id: string,
  patch: { title?: string },
): Promise<Photoshoot | null>
```

- Ownership-scoped; set `title` column; bump `updatedAt`; return reloaded shoot.

No schema migration — `title` columns exist; `brief` is already jsonb.

## API

Add `PATCH` to the existing route files (alongside `DELETE`).

### `PATCH /api/campaigns/[id]/route.ts`

- Zod body: `title?` (trimmed, 1–120 chars), `description?` (string, 0–600).
  At least one field required.
- `401` no session · `400` invalid body · `404` not owned · `200` `{ ok: true }`.
- Flow: `getSession` → `getUserKey` → `updateCampaign` → 404 if `null`.

### `PATCH /api/photoshoot/[id]/route.ts`

- Zod body: `title` (trimmed, 1–120 chars), required.
- Same status codes; calls `updatePhotoshoot`.

## Testing

- Unit tests for both `PATCH` handlers (mirror existing
  `tiles/[tileId]/regenerate/route.test.ts`): auth, validation, not-found,
  success.
- `InlineEditText` built test-first (TDD): commit on Enter/blur, cancel on Esc,
  empty-title revert, save error revert.
- `pnpm typecheck` after `src/` changes.

## Build order

1. `InlineEditText` primitive (TDD) + export from `components/ui`.
2. `updateCampaign` / `updatePhotoshoot` lib helpers.
3. `PATCH` route handlers + handler tests.
4. `CampaignHeaderEditable`; wire into `CampaignDetail`.
5. Wire `InlineEditText` into `PhotoshootResults` title.
6. `pnpm typecheck`.
