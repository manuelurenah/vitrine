# Cross-Flow UX — Design Spec

**Date**: 2026-06-08
**Author**: Claude (brainstorming session w/ @manuelurenah)
**Status**: Approved, pending implementation plan.

## Problem

The current app forces users through a linear creation funnel that re-uploads data the system already has:

- Catalog products can only be created by uploading new images. There is no way to attach an existing asset row — even one the system itself generated.
- Photoshoot output is a dead-end: download the image, then re-upload it elsewhere to use it as a product image or as a campaign reference.
- Photoshoot wizard takes no subject input. It cannot be invoked from "shoot this product" or "shoot this asset."

This means a normal demo path — onboarding → upload product photo → photoshoot → use winners in a campaign — requires the user to leave the app to manage files. `syncAssetsFromSnapshot` already writes a real `assets` row for every photoshoot tile, so the data exists; only the UX wiring is missing.

## Goal

Add targeted unblockers that let any user-owned asset, product, or photoshoot tile flow into any other creation surface without re-uploading.

Specifically:

1. Photoshoot output → "add to product" (existing or new) and → "use in campaign."
2. Catalog `AddProductForm` and brand `AssetUploader` accept "pick from library" alongside upload.
3. Photoshoot wizard accepts a subject prefill from an existing asset or product.

Out of scope: bidirectional "use as X" buttons on every entity, redesign of the wizards themselves, server-side promotion endpoints beyond the one new image-append route.

## Approach

Reuse the deep-link pattern the campaign wizard already supports (`/campaigns/new?refs=…`). Extend it to product creation and photoshoot creation. Reuse `AssetCatalogPicker` (already shipped, see `src/components/pickers/`) as the picker primitive everywhere. Add one new server endpoint to append existing assets to an existing product. No new abstractions.

This is the smallest delta that closes all three named gaps and stays consistent with existing route-handler + RSC patterns.

## URL contract

New query-param entry points:

- `/brand/catalog/new?images=asset:<id>,asset:<id>` — pre-stages library-picked assets in `AddProductForm`. IDs comma-separated, max 8, prefix `asset:` only. Server validates ownership.
- `/photoshoot/new?subject=asset:<id>` and `/photoshoot/new?subject=product:<id>` — pre-fills photoshoot subject step.
- `/campaigns/new?refs=…` — unchanged.

All deep-link IDs are untrusted. Server handlers and RSCs filter to the caller's `userKey`-owned rows; unknown IDs are silently dropped.

## Server API

### New: `POST /api/catalog/products/[id]/images`

Body: `{ assetIds: string[] }` (max 12, must be `assets.userId === userKey`).

Behaviour:

- Validates session + `getUserKey`.
- Validates product ownership.
- Filters `assetIds` to those owned by the same `userKey` and not already linked to this product (idempotent on duplicates).
- Inserts rows into `product_assets` (existing join table, see `src/lib/db/schema.ts:165`).
- Returns `{ product: Product, addedCount: number, skippedCount: number }`.

Errors:

- `401` no session
- `404` product not found or not owned
- `400` body shape invalid or `assetIds.length === 0`

### Modified: `POST /api/catalog/products`

Existing handler gains optional `existingAssetIds: string[]`. When present, those rows are linked into `product_assets` after the product insert, in the same transaction as uploaded images. Validated identically to the new endpoint.

## Component changes

### `CreativeCard` (`src/components/campaigns/CreativeCard.tsx`)

The card is reused by campaigns and photoshoot. Add a `context: 'campaign' | 'photoshoot'` prop (defaults to `'campaign'` for back-compat). When `'photoshoot'`:

- Renders a kebab menu `⋯` top-right of the thumbnail.
- Menu items: `use as product image`, `use in campaign`, `download`, `regenerate`.
- All items disabled while `status ∈ {queued, cooking}` or `assetId == null`.
- `regenerate` keeps existing behaviour, just moves under the menu.
- `use as product image` → opens `ProductPickerDialog` with `assetIds=[tile.assetId]`.
- `use in campaign` → `router.push('/campaigns/new?refs=asset:' + tile.assetId)`.
- `download` → existing behaviour.

In multi-select mode (see results page below), the kebab is hidden and the thumb becomes a checkbox surface; click toggles selection in parent state.

### `PhotoshootResults` (`src/components/photoshoot/PhotoshootResults.tsx`)

- Adds top-right `select` toggle button next to the buzz pill.
- Toggling on lifts a `Set<tileId>` to local state, dims tiles whose `status !== 'done'`, and renders a sticky `BulkActionBar`.
- `BulkActionBar`:
  - Left: `N selected · clear`.
  - Right: `add to product (N) →`, `start campaign (N) →`.
  - `add to product` → opens `ProductPickerDialog` with the ready tiles' `assetId`s.
  - `start campaign` → `router.push('/campaigns/new?refs=' + assetIds.map(id => 'asset:' + id).join(','))`.
- Selection is cleared on navigation away.

### New: `ProductPickerDialog` (`src/components/catalog/ProductPickerDialog.tsx`)

A modal listing the user's products in a small grid (hero thumb + name). Top: search input. Bottom: `+ new product`.

Props: `{ assetIds: string[]; onClose: () => void; onSuccess: (productId: string, addedCount: number) => void }`.

Behaviour:

- Loads `/api/catalog/products` on mount (RSC-fed initial list is preferred; modal accepts an initial-products prop).
- Picking a product → `POST /api/catalog/products/[id]/images { assetIds }` → on success calls `onSuccess` and closes. Toast: `added N images to <product> · view →`.
- `+ new product` → `router.push('/brand/catalog/new?images=' + assetIds.map(id => 'asset:' + id).join(','))`.

### `AddProductForm` (`src/components/catalog/AddProductForm.tsx`)

- Adds a tab strip at the top: `upload · pick from library`.
- `pick from library` tab embeds `AssetCatalogPicker` in assets-only mode.
- Library-picked assets render as new `StagedImage` rows with a distinct visual treatment (no progress bar, badge `from library`).
- On submit, the form splits its staged list into `uploads` (presign + PUT, existing path) and `existingAssetIds`. Both submit in a single `POST /api/catalog/products` call.
- Reads `?images=asset:<id>,…` on mount; for each parsed ID, fetches `/api/assets/<id>` and pushes the result into the library-picked staged list. Unknown / unauthorized IDs are silently dropped.

### `AssetUploader` (`src/components/assets/AssetUploader.tsx`)

- Same `upload · pick from library` tab strip.
- Library tab purpose: "promote" an existing asset into a brand collection (typically a logo/lockup/reference) by setting its `brandId` and `collection`. Implementation: tab-bound `PATCH /api/assets/<id>` with the brand and collection currently selected in the form.
- Does NOT re-upload the underlying object; the bucket row is unchanged.
- After patch: toast and navigate to `/brand/assets`.

### `PhotoshootWizard` (`src/components/photoshoot/PhotoshootWizard.tsx`)

- Subject step gains three options: `upload a photo`, `pick from library`, `skip — describe in text`.
- Library option opens `AssetCatalogPicker` (assets + products tabs). Picking a single item attaches it to the brief as the subject.
- Reads `?subject=asset:<id>` or `?subject=product:<id>` on mount; pre-fills.
- Subject thumb + name are surfaced in the brief recap before submit.
- The chosen subject's `publicUrl` is passed through as a reference image on every per-template generation (already supported by the orchestrator brief, see `src/lib/photoshoots.ts` + per-template prompts).

## Data flows

### A — photoshoot tile → existing product
`PhotoshootResults` tile menu → `ProductPickerDialog` opens with `assetIds=[tile.assetId]` → user picks product → `POST /api/catalog/products/<id>/images` → success toast linking to `/brand/catalog/<id>`.

### B — photoshoot tile(s) → new product
Tile menu / bulk bar → dialog → `+ new product` → `router.push('/brand/catalog/new?images=asset:<id>,…')` → `AddProductForm` pre-stages library rows → user fills name / SKU / tags → submit → existing `POST /api/catalog/products` with `existingAssetIds`.

### C — photoshoot tile(s) → campaign
Tile menu / bulk bar → `router.push('/campaigns/new?refs=asset:<id>,…')` → `CampaignWizard` parses (already supported, see `src/components/campaigns/CampaignWizard.tsx:131`).

### D — asset / product → photoshoot subject
Asset detail / product detail / catalog tile gain a `use as photoshoot subject` link → `router.push('/photoshoot/new?subject=asset:<id>')` (or `product:<id>`) → wizard pre-fills.

### E — picker symmetry (catalog AddProduct, AssetUploader)
Tab toggle in form → `AssetCatalogPicker` mounts with RSC-supplied initial library data → picked items added to local staged list → submit splits into uploads vs library-picked and routes accordingly.

## Ownership & integrity

- All deep-link IDs are filtered to the caller's `userKey`-owned rows on the server. Unknown IDs are silently dropped, not errors.
- `POST /api/catalog/products/[id]/images` enforces both `product.userId === userKey` AND `asset.userId === userKey` for every passed asset.
- The `existingAssetIds` body field on `POST /api/catalog/products` follows the same rule.
- `productAssets` insertion is idempotent: duplicates against the join table's unique key are skipped, not errored.
- Browser-supplied `?refs=`, `?images=`, `?subject=` never bypass these checks.

## Error handling

- All new endpoints return JSON `{ error: string }` on non-2xx. Status codes per route doc above.
- Client-side modals show inline error text (`text-danger`), no full-page errors.
- Multi-select bar disables actions when the selection contains zero ready tiles; shows a hint "no completed tiles selected".
- `ProductPickerDialog` shows an empty state with a `+ new product` CTA when the user has zero products.
- Deep-link parse failures (malformed IDs, > max count) are silently truncated and logged via `console.warn` only — never block page render.
- Tile-menu actions guarded against `assetId == null` (incomplete tiles) by disabling the items.

## Testing

E2E specs gain coverage for the new flows (suite already runs against MSW-mocked orchestrator + isolated test DB):

- `tests/e2e/55-photoshoot-cross-flow.spec.ts`
  - cook a photoshoot → "use in campaign" from tile menu → campaign wizard pre-filled with `refs=asset:…`.
  - cook a photoshoot → select 2 tiles → "add to product" → pick existing product → asserts `product_assets` rows exist via DB helper.
  - cook a photoshoot → select 2 tiles → "add to product" → "+ new product" → `AddProductForm` pre-stages library rows.

- `tests/e2e/35-catalog-picker.spec.ts`
  - `AddProductForm` `upload + pick from library` tab works; created product has both kinds of `product_assets` rows.
  - `AssetUploader` library tab promotes an existing asset (sets `brandId`, `collection`); `assets` row is patched, no duplicate row.

- `tests/e2e/65-photoshoot-subject.spec.ts`
  - From an asset detail page, "use as photoshoot subject" deep-links into the wizard with subject pre-filled.
  - From a product detail page, same.

Unit tests:

- `ProductPickerDialog` — pick flow, new flow, empty state.
- `AddProductForm` — splits staged list correctly; reads `?images=` and filters unauthorized IDs.
- `CreativeCard` — menu disabled states; multi-select toggle.

`pnpm typecheck` + `pnpm test:e2e` are the verification gates per `AGENTS.md`. Any schema change is unlikely (the join table already exists), but if any handler needs new validation columns, `pnpm db:generate` + `pnpm db:migrate` + `pnpm test:db:setup` follow.

## Open questions for implementation

- Confirm `photoshoot_brief` schema can carry a reference image URL alongside `productNotes` and template-level prompts — may need a small schema addition for `subjectAssetId` / `subjectProductId`. If yes, that's a migration in flow D.
- Subject-aware prompt injection: confirm the orchestrator workflow brief already accepts a reference image; if it does, no orchestrator change needed.

Both will be resolved during the implementation plan with a quick code read; they do not change the design shape.
