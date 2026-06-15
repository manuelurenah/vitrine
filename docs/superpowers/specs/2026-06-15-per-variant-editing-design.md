# Per-variant editing — design

**Date:** 2026-06-15
**Branch:** `fix/creative-editor-variant-selection`
**Status:** approved

## Problem

A campaign "creative" is a single `campaign_tiles` row with `quantity = N`. The N
images it renders ("variants") are just seed-samples of **one shared prompt +
one shared ad copy** — they have no independent identity, no independent version
history, and no per-variant regenerate. Editing or regenerating the tile affects
all variants at once, and the editor only ever displayed variant 0.

Desired behaviour: each variant of a creative is independently editable, has its
own version history, and regenerating one variant leaves its siblings untouched.

## Chosen approach — "Variant *is* a tile, grouped" (Approach A)

A **creative** becomes a *group of sibling tiles*. Each variant is its own
`campaign_tiles` row with `quantity = 1`, its own `workflow_id`, its own
`prompt` / `ad_copy` / `asset_id`, and its own `tile_versions` chain. Tiles that
belong to the same creative share a `variant_group_id`.

This reuses the existing per-tile machinery wholesale: `tile_versions`,
`regenerate`, the `PATCH /tiles/[tileId]` editor save, `buildTileRegenInput`,
and the `CreativeEditor` component are all already per-tile and need no
behavioural change. Per-variant independence falls out of the grouping.

### Rejected alternatives

- **Approach B — first-class `tile_variants` table.** Correct normalization and
  clean migration of existing data, but a large blast radius (new table,
  re-key `tile_versions` to `variantId`, rewrite `syncAssetsFromSnapshot`,
  editor, grid, regenerate, estimate). Rejected: too much risk for a demo when
  retroactive migration is explicitly not wanted.
- **Approach C — `variantIndex` on `tile_versions` + per-variant JSON overrides.**
  De-normalizes variant state into JSON and fights every existing per-tile
  query. Rejected: messier than B for less benefit.

## Data model

`campaign_tiles` gains two **nullable, forward-only** columns (no backfill):

| column | type | meaning |
|---|---|---|
| `variant_group_id` | `uuid` (nullable) | siblings of one creative share it; `NULL` = legacy tile |
| `variant_index` | `int` (default `0`) | position within the group |

New index: `(campaign_id, variant_group_id, variant_index)`.

A creative = tiles sharing a `variant_group_id`. Legacy tiles
(`variant_group_id IS NULL`) are treated as a group of one, keyed by their own
`tile.id`.

No new tables. `tile_versions` is already keyed by `tileId`, so each variant
tile carries its own version history with no schema change there.

## Cook flow

`POST /api/campaigns/cook` (`cook/route.ts`) currently submits one workflow per
preset with `numImages = variantsPerPreset`, producing one tile of
`quantity = variantsPerPreset`.

New behaviour, per preset:

1. Build the prompt + ad copy **once** (unchanged).
2. Generate one `variant_group_id` (`crypto.randomUUID()`).
3. Submit **N** workflows with `numImages = 1` (N = `variantsPerPreset`).
4. Emit N tile entries: identical `prompt` / `ad_copy`, `quantity = 1`, shared
   `variant_group_id`, `variant_index` `0..N-1`, each with its own `workflow_id`.

Fan-out grows from `P` to `P × N` submits, still via `Promise.allSettled` so a
single variant's submit failure stays isolated. `createCampaign` persists the
two new fields and already records `tile_versions` v1 per tile (each variant
starts its own chain). Total image count is unchanged, so total buzz is
unchanged.

`createCampaign` / `CreateCampaignInput.tiles[]` gain optional
`variantGroupId` + `variantIndex`; `toTile` carries them onto `CampaignTile`.

## Read + grouping

`CampaignTile` gains `variantGroupId: string | null` and `variantIndex: number`.
`getCampaign` / `loadCampaign` are otherwise unchanged.

`CampaignCreativeGrid` groups tiles by `variantGroupId ?? tile.id` into one row
per creative (preserving first-appearance order; filter pills still key off
`presetId`, which is constant within a group).

`CampaignCreativeRow` is reworked to take the **group's tiles** and render one
thumbnail per *(tile, image-slot)*, flattened from the group:

- **New creative:** N sibling tiles → N thumbnails, each linking to its own
  `/campaigns/{id}/c/{tileId}` editor — N independent editors.
- **Legacy tile** (`variantGroupId` NULL, `quantity > 1`): one tile → N slots
  from its single workflow, all linking to the same editor with `?v=<i>`
  (the existing display fix), no independence.

Each thumbnail polls its own tile workflow via `useTileWorkflow`. Row-level
download-all / redo loop over the group's sibling tiles.

## Editor / regenerate / versions — unchanged

- `CreativeEditor`, `PATCH /api/campaigns/[id]/tiles/[tileId]`, the regenerate
  route, the estimate route, and `tile_versions` are all already per-tile.
- A new variant tile has `quantity = 1`, and `buildTileRegenInput` already uses
  `tile.quantity ?? variantsPerPreset` (`regenerateInput.ts:83`), so regenerate
  and estimate produce exactly 1 image for a variant. Siblings are distinct
  rows → untouched.
- The `?v=` editor infrastructure (`initialVariant` prop + `pickCanvasImageUrl`)
  stays to support legacy multi-image tiles. New variant tiles use `?v=0`.

## UI polish

- `CampaignDetail` "N creatives" counts **distinct groups**, not tiles.
- `thumbUrl` and the campaigns list are unaffected (first tile with an asset).

## Out of scope

- No migration/backfill of existing campaigns — they keep rendering as legacy
  single-tile multi-image rows.
- No "edit all siblings at once", no add/remove variant after cook, no
  per-image re-roll within a legacy tile.

## Testing

- **Unit:** cook builds N tile entries per preset with a shared `variantGroupId`
  and `variantIndex 0..N-1`; grid grouping flattens new groups to N
  own-editor thumbnails and legacy NULL-group tiles to a multi-slot row.
- **Keep:** existing `pickCanvasImageUrl` tests (legacy path).
- **e2e** (MSW-mocked orchestrator; Civitai dev server is up): cook a
  single-preset ×N campaign → N thumbnails → edit variant #k → only #k gains a
  new version; siblings' version counts are unchanged.

## Risks

- **Cook latency / cost:** `P × N` orchestrator submits instead of `P`. Same
  image count, more calls; the app already fans out per tile. Accepted.
- **Export route** (`[id]/export`): iterates tiles — likely fine (more tiles),
  verify it labels/groups sensibly during implementation.
- **Legacy dual-path** in the row adds one branch; bounded and unit-tested.

## Verification

- `pnpm typecheck` after each phase.
- `pnpm db:generate` → review SQL → `pnpm db:migrate` + `pnpm test:db:setup`
  for the schema change.
- `pnpm test` for unit suites; `pnpm test:e2e` for the cook + edit flow.
