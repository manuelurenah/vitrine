# Campaign Review Feedback — Design Spec

**Date:** 2026-06-14
**Source:** `feedback/2026-06-14-campaign-review.md`
**Scope:** Campaign Details page (`/campaigns/[id]`) and Creative Editor
(`/campaigns/[id]/c/[creativeId]`).

This spec turns the 2026-06-14 campaign review into a concrete, implementable
design. It records the two claims the reviewer asked us to confirm, the
findings, and the design decision for each of the eight changes.

---

## Context: how the data is shaped today

- A campaign owns **tiles**. `cook` creates **one tile per preset**
  (`ig-story`, `ig-feed`, `li`, …) with `quantity = variantsPerPreset`. So a
  "row" in the reviewer's mental model maps 1:1 to a **tile**, and the N image
  variants of that row are that tile's `quantity` images. (`src/app/api/campaigns/cook/route.ts:104-129`, `src/lib/presets.ts`)
- The campaign detail page renders a 4-column grid of `CreativeCard`s, one card
  per tile. (`src/components/campaigns/CampaignCreativeGrid.tsx`, `src/components/campaigns/CreativeCard.tsx`)
- `CreativeCard` is **shared** by campaigns *and* photoshoots. Its workflow
  polling loop lives inline. (`CreativeCard.tsx`)
- The Creative Editor is **tile-scoped**: it loads one tile, polls its workflow,
  and shows `firstImageUrl`. (`src/components/campaigns/CreativeEditor.tsx`)
- A tile has version history (`tile_versions`). Versions are recorded at cook
  (`changeNote: 'cooked'`), edit (`'edited'`), and regenerate (`'regenerated'`).
  Each version row stores `workflowId`, `prompt`, `adCopy`, and a (currently
  always-null) `assetId`. (`src/lib/tileVersions.ts`, `src/lib/campaigns.ts:152,386,481`)
- Generated images become `assets` rows when a workflow reaches terminal
  success. `syncAssetsFromSnapshot` links the **first** asset to
  `campaignTiles.assetId` but never to the `tile_versions` row.
  Both `tile_versions` and `assets` carry `workflowId`.
  (`src/lib/assets.ts:306-374`)
- Brand palette (`string[]` hex) and `logoUrl` are stored on `brand_profiles`.
  Palette is injected into the prompt as `palette accents: …`
  (`src/lib/promptBuilder.ts`). **Logo is stored but never sent to the
  orchestrator.**
- Orchestrator cost preview without spending Buzz already exists:
  `estimateImageGen(session, input)` → `snapshot.cost.total`
  (`src/lib/civitai.ts:136-141`). There is **no** `/api/campaigns/estimate`
  route yet for the editor to call.

---

## Confirmed claims

### Claim A — "version history isn't storing the generated image" → **TRUE**

When you move between versions only the text changes; the background image stays
the same. Root cause:

- All three `recordTileVersion` call sites pass **no `assetId`**, so every
  version row has `assetId = null`. (`src/lib/campaigns.ts:152-158, 386-392, 481-487`)
- The editor seeds `imgUrls` from the **live** tile and never re-reads it when
  the viewed version changes. (`CreativeEditor.tsx:70`, `:112-118` sync only
  text/prompt)
- The history page renders a placeholder instead of the version's image.
  (`VersionHistory.tsx` — historical asset "not wired yet")

**Key insight that avoids a migration:** versions can be resolved to their image
by joining `tile_versions.workflowId → assets.workflowId`. An edit-only version
keeps the prior `workflowId` (text edits don't rebake the image until you
regenerate), so this join yields the *correct* image per version: cooked/edited
versions show the cooked image; a regenerated version shows its own new image.

### Claim B — "click the canvas to inspect" is misleading; text is baked in → **TRUE**

- The orchestrator **bakes the headline/subhead/CTA into the generated raster**
  via prompt directives in `copyLayer()` (`src/lib/promptBuilder.ts`).
- The editor *also* renders the same text as a **DOM overlay** on the canvas
  (`CreativeEditor.tsx:267-306`). On a finished creative the user sees the text
  **twice** (baked + overlay), and they can drift apart after an edit-without-
  regenerate.
- There is **no** click handler or element selection anywhere on the canvas.
  The line "edit on the right · or click the canvas to inspect"
  (`CreativeEditor.tsx:389`) promises an interaction that does not exist.

There is no feasible per-element editing of a baked raster without
regenerating. The honest fix is to make the canvas show the *actual* creative
and tell the truth about the editing model.

---

## Design decisions

### Campaign Details page

**FB-1 — Row-per-variant layout.**
Replace the card grid (in the **campaign** context only) with one **row per
tile**. Each row:
- Header line: the preset/platform label (e.g. `ig · story`) + the existing
  status badge beside it.
- A horizontal, scrollable strip of the tile's N images.
- Each image has a three-dots context menu and is click-through to the editor
  (`/campaigns/[id]/c/[tileId]`).
- The row **omits** headline/subhead/CTA text (those move out of the list).

New component `CampaignCreativeRow`. `CampaignCreativeGrid` renders rows in the
campaign context; the filter pills stay. The shared `CreativeCard` is left
intact for the photoshoot context. To avoid duplicating the polling loop, the
inline workflow-poll in `CreativeCard` is extracted into a reusable
`useTileWorkflow(workflowId, initial)` hook that both `CreativeCard` and
`CampaignCreativeRow` consume.

**FB-2 — Global row actions: download + redo.**
Row-level actions: **download** (zip all of the tile's images, reuse
`downloadImagesAsZip`) and **redo** (POST the existing tile regenerate route).
The per-image context menu offers: **edit** (→ editor), **download this image**,
and **regenerate** (tile-level). Kept intentionally small.

### Creative Editor

**FB-3 — Sticky right panel.**
Make the right column sticky so it follows scroll: `md:sticky md:top-6
self-start` with `max-h-[calc(100vh-…)] overflow-y-auto` on the panel container.
The grid already uses `items-start`.

**FB-4 — Estimated Buzz cost (remove hardcoded "3 buzz").**
Add `GET /api/campaigns/[id]/tiles/[tileId]/estimate` that builds the
fix-layout input and returns `estimateImageGen(...).cost.total` (no Buzz spent).
Factor the input-building shared by regenerate + estimate into one helper so the
estimate can't drift from the actual submission. The editor fetches the estimate
(on mount and when palette/logo/prompt inputs that affect the request change,
debounced) and shows the live number on both the **fix layout** button and the
promo card; a loading state shows `… buzz`. Replace both hardcoded `3 buzz`
literals (`CreativeEditor.tsx:341, 502`).

**FB-5 — Palette editing in the right panel.**
Add a **palette** panel seeded from the brand palette (editable hex swatches).
The edited palette is sent as an override on regenerate/fix-layout and replaces
`brand.palette` when the prompt is rebuilt (`buildCampaignPrompt`). The editor
page passes `brandPalette` to `CreativeEditor`.

**FB-6 — Logo editor in the right panel, sent to the orchestrator.**
Replace the "logo editing coming soon" placeholder with: the brand logo
thumbnail + an **include-logo** toggle. When enabled, regenerate/fix-layout
sends `logoUrl`, which the route (a) appends to the orchestrator `images[]`
array as an extra reference and (b) adds a prompt directive via `promptBuilder`
("incorporate the supplied brand logo, small, in a corner, preserving its exact
shape and colors"). No new `VitrineImageGenInput` field is required — the logo
rides in `images[]`. The editor page passes `brandLogoUrl`.

> **Known uncertainty (documented, not blocking):** the orchestrator's handling
> of a logo passed as a reference image is approximate, not exact compositing.
> This is the feasible v1 within the current generation pipeline and is what the
> feedback asked for ("sent to the orchestrator when creating a new version").
> Exact pixel-accurate logo compositing would be a separate post-processing
> feature and is out of scope here.

**FB-7 — Version history stores/shows the generated image.**
No migration. Enrich `listTileVersions` to LEFT JOIN `assets` on `workflowId`
(first image, `deletedAt IS NULL`) and add `assetUrl` to `TileVersionEntry`
(client-safe type in `tileVersionsDiff.ts`). In `CreativeEditor`, drive the
canvas background from `currentVersion.assetUrl`, falling back to the live
polled `imgUrls` for the latest version (and while cooking). Wire
`VersionHistory` (history page) to show each version's image instead of the
placeholder.

**FB-8 — Canvas: remove the false "inspect" affordance and the double text.**
Remove the DOM text overlay from the canvas so it shows only the real baked
creative (the actual downloadable artifact). Replace the misleading line with
accurate copy, e.g. "edit fields on the right · changes apply when you
regenerate." This eliminates the doubled text and the non-existent
click-to-select promise. (Consistent with FB-7: the canvas now always shows the
viewed version's real image.)

---

## Out of scope

- Pixel-accurate logo compositing (post-processing pipeline).
- Per-element drag/layout editing of baked text.
- Schema migrations (the version-image fix uses an existing `workflowId` join).
- Photoshoot detail page (the row redesign is campaign-only; `CreativeCard`
  stays for photoshoots).
- The disabled `share` / `animate` actions (already "coming soon").

## Testing strategy

- **lib/route logic** has existing `*.test.ts` suites (vitest). Add/extend tests
  for: `listTileVersions` assetUrl join; the shared regenerate-input helper;
  regenerate route accepting palette/logo overrides; the new estimate route.
- **E2E** (`50-campaigns`) cooks against MSW-mocked orchestrator. The row layout
  and editor changes touch `data-testid` hooks; preserve existing testids
  (`creative-editor`, `editor-fix-layout`, `editor-field-*`, `editor-version-*`,
  etc.) and add new ones for the row + palette/logo panels. Re-run
  `pnpm typecheck` + the campaign e2e spec.

## Affected files (anticipated)

- `src/lib/tileVersions.ts`, `src/lib/tileVersionsDiff.ts` — `assetUrl` on versions.
- `src/lib/promptBuilder.ts` — logo directive + palette override hook.
- `src/lib/campaigns.ts` — (regenerate-input helper may live here or a new module).
- `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts` — palette/logo overrides.
- `src/app/api/campaigns/[id]/tiles/[tileId]/estimate/route.ts` — **new**.
- `src/components/campaigns/CreativeCard.tsx` — extract `useTileWorkflow`.
- `src/components/campaigns/useTileWorkflow.ts` — **new** hook.
- `src/components/campaigns/CampaignCreativeRow.tsx` — **new**.
- `src/components/campaigns/CampaignCreativeGrid.tsx` — render rows in campaign context.
- `src/components/campaigns/CreativeEditor.tsx` — sticky panel, canvas/version image, palette + logo panels, estimate, copy fix.
- `src/components/campaigns/VersionHistory.tsx` — show version images.
- `src/app/(app)/campaigns/[id]/c/[creativeId]/page.tsx` + `history/page.tsx` — pass brand palette/logo + version assetUrl.
