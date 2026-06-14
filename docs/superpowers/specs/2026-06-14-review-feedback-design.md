# Spec — Review Feedback 2026-06-14

Source: `2026-06-14-review-feedback.md`. Closes UX/IA gaps across three
surfaces: **Brand DNA** (`/brand`), **Catalog** (move out of `/brand`), and
**Assets** (move out of `/brand` + rework ad-hoc generation).

## Goal

Make catalog and assets first-class top-level sections (out from under
`/brand`), tighten the Brand DNA editor, and make ad-hoc image generation feel
like campaign/photoshoot cooking (placeholder cards + live polling, no manual
result selection). Also fold the product edit page into the product detail page
as inline editing, and delete the standalone edit route.

## Out of scope

- No DB schema migrations. All needed columns already exist (`assets.sourceTileId`
  is the lever that separates ad-hoc generated assets from campaign/photoshoot
  ones; `brandProfiles.sourceUrl` already stores the brand URL).
- No changes to campaign/photoshoot cook pipelines beyond reusing their
  polling/placeholder UI patterns for ad-hoc generation.
- No new OAuth scopes, no orchestrator changes.
- Image mirroring to S3 for ad-hoc results is **not** added — ad-hoc assets store
  the orchestrator URL directly, matching current campaign/photoshoot behavior.

---

## Area A — Routing moves (cross-cutting)

Move catalog and assets out of the `/brand` namespace to top level. `/brand`
keeps only Brand DNA. Old paths must not 404 mid-migration: move the route
directories and update **every** internal reference (Links, `router.push`,
`redirect`, nav config, route-detection).

### A1. Catalog routes
- `/brand/catalog` → `/catalog` (list)
- `/brand/catalog/new` → `/catalog/new`
- `/brand/catalog/[id]` → `/catalog/[id]` (detail)
- `/brand/catalog/[id]/edit` → **deleted** (see C7)

### A2. Assets routes
- `/brand/assets` → `/assets` (list)
- `/brand/assets/new` → `/assets/new` (upload)
- `/brand/assets/[id]` → `/assets/[id]` (detail)

### A3. References to update (from exploration)
Catalog: `CatalogGrid.tsx`, `CatalogControls.tsx`, `ProductDetail.tsx`,
`ProductDetailGallery.tsx`, `AddProductForm.tsx` (default `redirectTo`),
`DeleteProductButton.tsx`, `ProductPickerDialog.tsx` (`buildNewProductHref`),
`PhotoshootResults.tsx`, `AssetCatalogPicker.tsx`, `AssetsEmptyState.tsx`,
plus nav/shell: `shell/nav.ts`, `shell/BrandSubTabs.tsx`, `shell/AppShell.tsx`.

Assets: `AssetsGallery.tsx`, `AssetUploader.tsx`, `AssetDetailView.tsx`,
`AssetsEmptyState.tsx`, `CatalogGrid.tsx` (secondary link), `ProductDetailGallery.tsx`,
`ProductPickerDialog.tsx`, plus nav/shell entries and active-state detection.

### A4. Nav / IA
`shell/nav.ts` currently nests catalog/assets under brand (`indent: true`).
Promote catalog and assets to their own top-level nav entries (no longer brand
sub-tabs). `BrandSubTabs` collapses to brand-only (or is removed if it would be a
single tab — decide during impl based on what's left under `/brand`). Update
`AppShell` active-route detection to match the new top-level paths.

**Acceptance:** Navigating the app, every catalog/asset link lands on the new
path; no link or redirect points at `/brand/catalog` or `/brand/assets`;
`grep -rn "/brand/catalog\|/brand/assets" src` returns nothing (except inside
moved files referencing their own new paths).

---

## Area B — Brand DNA (`/brand`)

File: `src/components/brand/BrandEditor.tsx` (+ new rescrape route + `BrandEditor` tests).

### B1. Rescrape the brand URL
Add a "rescrape" action near the brand URL display. It re-runs the scraper
against the stored `sourceUrl` and repopulates the editable fields the scraper
can fill (palette, font, logoUrl, description, tagline if present) into form
state **without auto-saving** — user reviews, then Save persists.

New endpoint: `POST /api/brand/[id]/rescrape` — auth + ownership checked, reads
the brand's stored `sourceUrl`, calls `scrapeSite(url)` (pure lib in
`src/lib/scrape.ts`), returns the `ScrapedSite` shape. It must **not** mutate
the onboarding payload (unlike `/api/onboarding/scrape`). Surfaces a loading
state while scraping and an error if the scrape fails (`ScrapeError` codes).

### B2. Brand URL not editable once set
After `sourceUrl` is set, render it as read-only text (hostname display), not an
`<input>`. The rescrape button uses the stored value. (If `sourceUrl` is empty —
shouldn't happen post-onboarding but guard anyway — allow setting it once.)
Rationale per feedback: prevent accidental rebranding.

### B3. Tagline + description on one card
Merge the separate tagline and description cards into a single identity/voice
card containing both fields.

### B4. Field labels on identity card
Each input in the identity card gets a visible `FieldLabel` (name, industry,
url). Today only the eyebrow `// identity` exists; add per-field labels.

### B5. Save disabled until dirty
Track initial brand snapshot; Save button is disabled unless the form differs
from the loaded brand (in addition to the existing `name` non-empty rule).
Resets to clean after a successful save.

### B6. Loading state on Save
Save shows an in-flight state (spinner / "saving…") while the PATCH is in
flight, disabled during. (Partially present today via `busy` — verify and make
explicit with a spinner.)

**Acceptance:** Rescrape repopulates palette/font/logo/description from the live
site and leaves the form dirty (Save enabled); URL field is read-only once set;
tagline + description share a card; identity inputs have labels; Save is disabled
on a pristine form and shows a spinner while saving.

---

## Area C — Catalog

### C1. Re-route
Covered by A1/A3.

### C2. Context-menu icons
The per-card context menu (`CatalogControls` `CardMenu`, and the detail
`MoreMenu`) gets a leading lucide icon per option (e.g. `Pencil` for edit/“use”,
`Trash2` for delete).

### C3. Remove bottom "add another product" CTA
Delete the `add another product` CTA at the end of the grid/list
(`CatalogControls.tsx:340-346`). Keep the single top CTA in `CatalogGrid` header
(+ mobile FAB).

### C4. Card fully clickable
Already implemented (absolute-inset Link). Verify both grid card and list row
remain fully clickable to `/catalog/[id]` after the route move; ensure context
menu still stops propagation.

### C5. New product page
- Back button (to `/catalog`).
- Replace eyebrow `brand DNA · new` → `// catalog`.

### C6. Product detail page
- **CTAs top-right, same row as back button.** Move "use in campaign" / "use in
  photoshoot" + the context-menu button into the header row beside the back
  button (today they live in the gallery action bar).
- **"use in campaign" = primary CTA, "use in photoshoot" = secondary.** Style as
  Buttons (primary/secondary variants) with leading icons.
- **Live/status badge above the product title**, replacing the redundant
  `// product` eyebrow.
- **Improve contrast** of the action buttons overlaid on the product image
  (hero top-right controls in `ProductDetailGallery`).
- **Carousel: keep only "upload", remove the redundant "add" action** (they do
  the same thing today).
- **Consistent border radius** across all action buttons on this page.

### C7. Inline edit (replace the edit page)
Delete `/catalog/[id]/edit` and `EditProductForm` usage as a standalone page.
Make the detail page's right-hand metadata panel toggle into editable inputs
(name, description, tags, status) in place. An "edit" affordance flips the panel
to edit mode; Save PATCHes `/api/catalog/products/[id]` and returns to read mode;
Cancel reverts. Image reordering/hero/add/remove continues to work on the detail
gallery (it largely already does). Reuse `EditProductForm`'s field logic where
practical; the file may be repurposed into an inline-editable panel component.

**Acceptance:** No `/catalog/[id]/edit` route exists; editing happens inline on
the detail page; detail header shows back + primary "use in campaign" +
secondary "use in photoshoot" + context menu in one row; live badge sits above
the title; context menus have icons; no bottom "add another product" CTA; image
overlay actions have readable contrast and uniform radius; carousel shows a
single upload action.

---

## Area D — Assets + ad-hoc generation

### D1. Re-route
Covered by A2/A3.

### D2. Assets library = uploads + ad-hoc generated only
`/assets` must exclude generated images that belong to a campaign or photoshoot
(those have their own pages). The exclusion rule: drop rows where
`kind = 'generated' AND sourceTileId IS NOT NULL`. Everything else stays —
uploads (null `sourceTileId`, fine) and ad-hoc generated (`kind='generated'`,
null `sourceTileId`). Implement via a new `listLibraryAssets(userId)` (or a
`listAssets({ excludeTileLinked: true })` option) in `src/lib/assets.ts`.

### D3. CTAs in the title row
Move Upload + Generate CTAs into the page title row (mirroring `/catalog`):
**Upload = primary**, **Generate = secondary**. Remove them from the toolbar.

### D4. Sorting dropdown
Add a sort dropdown next to the grid/list view toggle (mirror `/catalog`'s
`CatalogControls` sort: recent / name / type or similar). Wire it to reorder the
rendered assets.

### D5. Ad-hoc generation modal polish
File: `AdHocGenerationModal.tsx`.
- **Autofocus** the prompt textarea on modal open.
- **Remove the "+" prefix** on the negative-prompt and reference-images accordion
  toggles; the chevron up/down indicator is the only affordance.
- **Reference image picker = assets only.** The reference picker must allow
  selecting only asset (uploaded) images, not products. Pass the picker an
  assets-only mode (hide the products tab) and keep `includeGenerated=false`.

### D6. Ad-hoc generation: cooking cards + live polling (no selection step)
Replace the modal's polling + results-selection phases entirely. New flow:
1. User fills the form and clicks Generate.
2. Client POSTs `/api/assets/generate` (submit), gets `{ workflowId }`, closes
   the modal.
3. The `/assets` grid renders a **placeholder cooking card** per in-flight
   ad-hoc generation (mirroring `CreativeCard`'s placeholder glow / skeleton +
   `cooking…` overlay), polling `/api/workflow/[id]?wait=15000`.
4. On terminal success the workflow route's `syncAssetsFromSnapshot` already
   creates `generated` asset rows (`sourceTileId = null`) for **all** images —
   no manual selection. The grid refreshes and the cooking card(s) resolve into
   real asset tiles.

Server support:
- `/assets` page lists in-flight ad-hoc generations (non-terminal generations
  with `source = 'adhoc'`) so it can render cooking placeholders on load/refresh.
  Add a lib helper (e.g. `listActiveAdhocGenerations(userId)` in
  `src/lib/generations.ts`) returning the workflowId + expected image count +
  prompt for each.
- The results-selection endpoint `/api/assets/generate/save` and the modal's
  results/polling phases are **removed** (or the endpoint left unused/deleted).
  Buzz `estimate` (on submit) + `submit` (on terminal, in workflow route) are
  preserved exactly as today — do not break the audit trail.

**Acceptance:** Clicking Generate closes the modal and immediately shows a
cooking placeholder card in `/assets`; the card live-polls and resolves to the
generated image(s); all generated images are saved as ad-hoc assets and appear
in the library; no manual "select which results to save" step exists;
campaign/photoshoot generated images do **not** appear in `/assets`.

### D7. New asset (upload) page
File: `AssetUploader.tsx` + `/assets/new/page.tsx`.
- Back button (to `/assets`).
- Replace eyebrow `brand DNA · upload` → `// upload`.
- Remove the upload-vs-pick-from-library tabs; the page is upload-only (drop the
  library/promote tab and its `AssetCatalogPicker`).
- Accepted file types: **svg, png, jpg only** (`accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"`),
  and validate on the client/finalize against those types. (Feedback "sbg" = svg
  typo.)
- Change the "add to library" button icon to a **save** icon (lucide `Save`).

**Acceptance:** `/assets/new` is upload-only with a back button and `// upload`
eyebrow; only svg/png/jpg are accepted; the submit button uses a save icon.

---

## Backend / lib change summary

| Change | Where |
|---|---|
| New rescrape route (no payload mutation) | `src/app/api/brand/[id]/rescrape/route.ts` |
| Library asset filter (exclude tile-linked generated) | `src/lib/assets.ts` (`listLibraryAssets` or option) |
| Active ad-hoc generations helper | `src/lib/generations.ts` |
| Remove ad-hoc save endpoint usage | `src/app/api/assets/generate/save/*` |
| Move route dirs (catalog, assets) | `src/app/(app)/...` |
| Delete edit route | `src/app/(app)/.../catalog/[id]/edit` |

No schema migration. `pnpm typecheck` must pass; touched route/security files →
`pnpm build`; e2e specs for campaigns/assets must stay green.

## Testing

- `pnpm typecheck` after every area.
- Unit: update/extend `AdHocGenerationModal.test.tsx` (autofocus, accordion
  chevron-only, assets-only reference picker, generate closes + signals cooking),
  `AddProductForm.test.ts`, `BrandEditor` (dirty-gating, rescrape) if a test
  exists or is warranted.
- e2e: the existing assets/catalog specs reference `/brand/...` paths — update
  any path assertions; `pnpm test:e2e` (campaigns + assets specs) stays green.
- `pnpm build` once routing + security-relevant changes land.
</content>
