# Plan: products keep at least one image

## Goal

A catalog product must always retain at least one non-deleted image. Block any
delete that would leave a product with zero images, both server-side
(authoritative) and in the product gallery UI.

## Background (read before any task)

- Removing a photo from a product = soft-deleting the underlying asset.
  The product gallery's `deletePhoto` calls `DELETE /api/assets/:id`, which
  calls `softDeleteAsset(userId, id)` (sets `assets.deleted_at`). This is the
  ONLY caller of `softDeleteAsset`.
- A product's images = rows in `product_assets` (productId, assetId) joined to
  `assets` filtered on `deleted_at IS NULL`, ordered by `position`. See
  `listAssetsForProduct` in `src/lib/assets.ts`.
- Soft-deleting an asset leaves the `product_assets` join row but the photo
  disappears from the gallery because `listAssetsForProduct` filters
  `deleted_at`.
- `DELETE /api/assets/[id]/route.ts` is the single user-facing delete path.

## Global Constraints (binding — reviewers must enforce verbatim)

- Stack: Next.js 16 App Router, Drizzle ORM, TypeScript strict, React 19.
- Tests: vitest. Run a file with `pnpm vitest run <path>`. Component tests in
  this repo render with `renderToStaticMarkup` from `react-dom/server` (see
  `src/components/catalog/ProductPickerDialog.test.tsx`) — follow that pattern,
  do NOT add @testing-library.
- Error contract: when a delete would empty a product, the server responds
  HTTP **409** with JSON body exactly `{ "error": "last_product_image" }`.
- Must NOT change delete behavior for: assets not linked to any product, or
  assets whose product still has another non-deleted image.
- Security/patterns per AGENTS.md: ownership always scoped by `userKey`; never
  trust client-supplied storage pointers; keep SDK/token logic server-side.
- TypeScript must pass `pnpm typecheck` with zero new errors.
- Scope is the product gallery only. Do NOT add min-image rules to brand,
  photoshoot, or the asset library as separate features. (The server guard
  naturally also blocks deleting a product's sole image from the asset library;
  that is the same rule, not new scope.)

---

## Task 1 — Server guard (authoritative)

**Files:** `src/lib/assets.ts`, `src/app/api/assets/[id]/route.ts`, and a new
test file `src/app/api/assets/[id]/route.test.ts`.

### 1a. Helper `isSoleProductImage`

Add to `src/lib/assets.ts`:

```ts
/**
 * True if soft-deleting `assetId` would leave at least one product it belongs
 * to with zero non-deleted images. Used to block deleting a product's last
 * photo. Ownership-scoped by userId. Returns false if the asset is linked to
 * no product, or every linked product still has another non-deleted image.
 */
export async function isSoleProductImage(userId: string, assetId: string): Promise<boolean>
```

Logic:
- Find every `product_assets.product_id` linked to `assetId` where the asset is
  owned by `userId` and not already deleted.
- For each such product, count its non-deleted images
  (`product_assets ⨝ assets WHERE deleted_at IS NULL`).
- Return `true` if any linked product's count is `<= 1` (deleting this asset
  empties it); otherwise `false`.
- A single SQL query is preferred (e.g. a grouped count over the products this
  asset belongs to, then test `min(count) <= 1`). Match the Drizzle style
  already used in this file (`db.select(...).from(...).innerJoin(...).where(and(...))`).

### 1b. Wire into the DELETE route

In `src/app/api/assets/[id]/route.ts` `DELETE`, after resolving `userKey` and
`id`, BEFORE calling `softDeleteAsset`:

```ts
if (await isSoleProductImage(userKey, id)) {
  return NextResponse.json({ error: 'last_product_image' }, { status: 409 });
}
```

Leave the existing 401 / 404 / success behavior unchanged.

### 1c. Tests — `src/app/api/assets/[id]/route.test.ts` (new)

Mock `@/lib/assets` (`getAsset`, `updateAsset`, `softDeleteAsset`,
`isSoleProductImage`), `@/lib/session` (`getSession`), `@/lib/userKey`
(`getUserKey`). Cover the DELETE handler:

1. Returns 401 when no session.
2. Returns **409** with body `{ error: 'last_product_image' }` when
   `isSoleProductImage` resolves true; asserts `softDeleteAsset` was NOT called.
3. Returns 200 `{ ok: true }` when `isSoleProductImage` is false and
   `softDeleteAsset` resolves true.
4. Returns 404 when `isSoleProductImage` is false and `softDeleteAsset`
   resolves false.

Also add a unit test for `isSoleProductImage` itself. Mock `@/lib/db`'s `db`
query builder following the established mock pattern in
`src/lib/catalog.test.ts` (symbol-tagged where-clause). Cover:
- product with exactly 1 image (this asset) → `true`
- product with 2 images → `false`
- asset linked to no product → `false`

If mocking the query builder for the helper proves disproportionate, the
implementer may instead assert the helper's SQL shape is exercised via the
route test's mock and note the limitation in the report — but prefer a real
helper test.

### Verification
- `pnpm vitest run src/app/api/assets/[id]/route.test.ts` green.
- `pnpm typecheck` clean.

---

## Task 2 — Product gallery UI guard

**Files:** `src/components/catalog/ProductDetailGallery.tsx` and its test
(create `src/components/catalog/ProductDetailGallery.test.tsx` if absent).

### 2a. Disable delete on the last photo

In `ProductDetailGallery`:
- Compute `isLastImage = total <= 1`.
- Both the hero delete button and any photo-strip delete button: when
  `isLastImage`, set `disabled` and `title`/`aria-label` to
  `"a product needs at least one image"`, using the same disabled visual
  treatment already used for the disabled wand button
  (`cursor-not-allowed opacity-60`). Keep the existing `deletingId` disabled
  behavior too (combine the conditions).

### 2b. Guard `deletePhoto`

At the top of `deletePhoto`, before the confirm/API call:
```ts
if (images.length <= 1) return; // safety net; button is already disabled
```
Handle a 409 from the API distinctly: when `res.status === 409`, surface the
message `"a product needs at least one image"` (reuse the existing
`uploadError`/error display channel, or an equivalent inline error — do not use
`window.alert` for this case) instead of the generic "delete failed".

### 2c. Test — `ProductDetailGallery.test.tsx`

Following the `renderToStaticMarkup` pattern from
`src/components/catalog/ProductPickerDialog.test.tsx`:
- Render with **one** image → the delete button(s) render with the `disabled`
  attribute and the "a product needs at least one image" label.
- Render with **two** images → the delete button is NOT disabled (no
  `disabled` attribute on it).

Mock `next/navigation` `useRouter` as needed (see existing component tests for
the pattern).

### Verification
- `pnpm vitest run src/components/catalog/ProductDetailGallery.test.tsx` green.
- `pnpm typecheck` clean.

---

## Out of scope

- Brand / photoshoot / asset-library-wide minimum-image rules.
- Reworking "remove from product" vs "delete asset" semantics (they remain the
  same shared soft-delete).
- Fixing the pre-existing stale-hero behavior noted in the gallery comments.
