# Ad Campaigns (Civitai Ads) — Design Spec

**Date:** 2026-06-17
**Status:** Approved (autonomous — user waived approval gate via `/goal`)
**Branch:** `feat/ad-campaigns`
**Source request:** `civitai-ad-campaign-support.md`

## 1. Problem

Vitrine users want **ready-to-upload images for the Civitai advertising platform** — creatives at the platform's exact supported pixel dimensions that "show properly" in the ad slots. Today the app only produces social creatives (`campaigns`) and product shots (`photoshoots`), both at flexible aspect ratios chosen by the generator. Neither yields exact-pixel ad deliverables.

### Supported ad formats (verbatim from request)

| Format | Device | Sizes (W×H) |
|---|---|---|
| Footer | mobile | 320×50 |
| Footer | desktop | 728×90, 970×90 |
| Banner | mobile | 300×250 |
| Banner | desktop | 728×90, 970×250 |
| Rectangle | any | 300×250 |
| Skyscraper | any | 300×600 |

**Six unique pixel sizes** across the formats: `320×50`, `728×90`, `970×90`, `300×250`, `970×250`, `300×600`.

## 2. Core constraint & the resulting key decision

The orchestrator image path (`buildVitrineImageGenBody` → Google `nano-banana-2`) accepts only `aspectRatio ∈ {1:1, 4:5, 9:16, 16:9}` plus `resolution ∈ {1K, 2K}`. It **cannot** be asked for arbitrary pixel dimensions, and the Google engine does not emit extreme ratios like 8:1 (leaderboards) or 1:2 (skyscraper) natively.

**Decision: exact pixels come from a deterministic post-generation crop, not from the generator.**

1. Map each ad size to the **nearest supported aspect ratio** (minimising |targetRatio − candidateRatio| over the 4 allowed ratios).
2. Generate one creative per size at that ratio, `resolution: '2K'` (maximise source pixels available for cropping/downscaling).
3. On **download/export**, center-crop + scale (cover-fit) the generated image to the **exact** W×H, producing pixel-perfect PNGs. This guarantees the "ready to upload, shows properly" requirement regardless of generator limits.

### Nearest-ratio mapping (minimise ratio distance)

| Size | ratio | Nearest of {1:1,4:5,9:16,16:9} | Crop severity |
|---|---|---|---|
| 320×50 | 6.40 | **16:9** (1.78) | heavy — keeps central horizontal band |
| 728×90 | 8.09 | **16:9** | heavy |
| 970×90 | 10.78 | **16:9** | heavy |
| 300×250 | 1.20 | **1:1** (1.00) | light |
| 970×250 | 3.88 | **16:9** | moderate |
| 300×600 | 0.50 | **9:16** (0.5625) | light |

> Note `presetAspect()` in `promptBuilder.ts` would mis-map 300×250 (1.2) to `4:5` (portrait). Ads need a true nearest-ratio function — see §6.1 `nearestAspect`.

### Crop-aware prompting

Because leaderboards (16:9 → 8:1) discard most vertical content, the ad prompt builder composes for the **target** rectangle: subject + any copy kept inside a central horizontal/vertical safe band, simple backgrounds that survive a thin-strip crop, generous bleed margins. Documented limitation: heavy crops are inherently lossy; this is acceptable for an MVP and noted in the UI.

## 3. Scope

### In scope (MVP)
- Ad-format catalog (`adFormats.ts`) encoding the request + flattened selectable sizes.
- New **Ad Campaign** entity: brief + brand + selected sizes → cook → one branded creative per size → persist.
- List, New (wizard), and Detail pages under the gated `(app)` shell; nav entry.
- Per-creative polling (reuse `/api/workflow/[id]`), regenerate (prompt hint), and **exact-pixel download** (single + ZIP-all).
- Optional **campaign-level ad copy** (one headline/subhead/CTA applied to all sizes; off by default — avoids unreliable tiny-text rendering).
- Cost estimate surfaced before cook (mirrors campaigns).
- DB tables + migration; extend shared asset/generation plumbing.
- Unit + e2e tests.

### Out of scope (YAGNI — explicitly deferred)
- Per-tile version history (ad tiles are versionless, like photoshoots).
- Dedicated creative-editor page (regenerate is an inline dialog on the detail grid).
- Multiple variants per size, A/B concepts, upscale/animate on ad tiles.
- **Deterministic text/logo overlay compositor** — the more "correct" long-term answer for legible ad copy at tiny sizes, but a substantial sub-feature. MVP bakes optional copy into the prompt instead. Recorded as the top future enhancement.
- Per-size LLM ad-copy generation.

## 4. Architecture — a dedicated sibling feature

`campaigns` and `photoshoots` are two parallel sibling features; **ad campaigns is a third sibling**. This keeps the green, tested campaigns feature untouched (zero regression risk) and mirrors the established split. All heavy shared plumbing is **reused unchanged or extended surgically**:

| Layer | Reuse / extend |
|---|---|
| Brand injection | `getDefaultBrand`, `brandLayer` — reuse |
| Brief schema | `briefSchema`, `BriefForPresets` — reuse |
| Orchestrator | `submitImageGen`, `estimateImageGen`, `VitrineImageGenInput` — reuse |
| Generation audit | `recordGeneration` — reuse (+ enum value `ad_campaign`) |
| Buzz audit | `recordBuzzEvent` — reuse |
| Asset sync | `syncAssetsFromSnapshot`, `markTileFailed` — **extend** with an `adCampaignTiles` branch |
| Workflow polling | `/api/workflow/[id]` — reuse unchanged (source-agnostic; works once asset/gen plumbing knows ad tiles) |
| Reference assets | `getPublicUrls`, `MissingReferenceError` — reuse |
| User key | `getUserKey` — reuse |

New code: catalog, one lib module, two tables, three `/api/ads/*` routes, three pages, `components/ads/*`, an export util, a nav entry.

## 5. Data model

Two new tables, mirroring `campaigns`/`campaignTiles` minus version history, plus ad-size columns. Reuse the existing `tile_status` enum.

```
ad_campaigns (PK id)
  id            uuid pk default random
  userId        text  FK users.id cascade   (notNull)
  brandId       uuid  FK brandProfiles.id set null
  productId     uuid  FK products.id set null
  title         text  notNull
  brief         jsonb notNull               -- BriefForPresets
  sizeIds       text[] notNull default {}   -- AdSizeId[]
  referenceAssetIds text[] notNull default {}
  enhancedPrompts   jsonb                   -- Record<AdSizeId, EnhancedPrompt>
  adCopy        jsonb                        -- AdCopy | null (campaign-level)
  audience      text
  aesthetics    text
  estimatedBuzz int notNull default 0
  actualBuzz    int notNull default 0
  createdAt, updatedAt timestamp notNull default now
  index ad_campaigns_user_created_idx (userId, createdAt)

ad_campaign_tiles (PK id)
  id            uuid pk default random
  adCampaignId  uuid FK ad_campaigns.id cascade (notNull)
  sizeId        text notNull                 -- AdSizeId
  width         int  notNull
  height        int  notNull
  aspectRatio   text notNull                 -- generation AR ('1:1'|'4:5'|'9:16'|'16:9')
  workflowId    text notNull unique
  prompt        text notNull
  seed          text
  quantity      int notNull default 1
  status        tile_status notNull default 'queued'
  estimatedBuzz int notNull default 0
  actualBuzz    int notNull default 0
  assetId       uuid FK assets.id set null
  adCopy        jsonb                         -- AdCopy | null (snapshot at cook)
  error         text
  createdAt, updatedAt timestamp notNull default now
  index ad_campaign_tiles_campaign_idx (adCampaignId)
  unique index ad_campaign_tiles_workflow_uidx (workflowId)
```

Enum change: add `'ad_campaign'` to the `generation_source` pgEnum. `GenerationSource` derives from the schema enum, so `recordGeneration({ source: 'ad_campaign' })` type-checks with no other change.

Asset linkage: ad tiles reuse `assets.sourceTileId` + `kind: 'generated'` exactly like campaign/photoshoot tiles, so they are correctly excluded from the library view (`isLibraryAsset`).

## 6. Module designs

### 6.1 `src/lib/adFormats.ts` (new, no server-only import — pure, unit-testable)

```ts
export type AdDevice = 'mobile' | 'desktop' | 'any';
export type AdSizeId = string;            // e.g. 'footer-320x50'

export type AdFormatDef = {
  name: 'Footer' | 'Banner' | 'Rectangle' | 'Skyscraper';
  sizes: Partial<Record<AdDevice, [number, number][]>>;
};

export type AdSizeDef = {
  id: AdSizeId;             // stable slug, e.g. 'leaderboard-728x90'
  label: string;           // 'Leaderboard · 728×90'
  formats: string[];       // which ad formats use this size, e.g. ['Footer','Banner']
  width: number;
  height: number;
  ratio: string;           // '728:90' display
  aspectRatio: AspectRatio;// generation AR via nearestAspect()
  styleNotes: string;      // crop-aware composition guidance per shape
};

export const AD_FORMATS: AdFormatDef[];               // verbatim request JSON
export const AD_SIZES: Record<AdSizeId, AdSizeDef>;   // 6 unique sizes
export const AD_SIZE_LIST: AdSizeDef[];
export function isAdSizeId(v: string): v is AdSizeId;
export function recommendedAdSizeIds(): AdSizeId[];    // sensible default selection
export function nearestAspect(w: number, h: number): AspectRatio; // min |ratio diff| over 4 allowed
```

Six unique sizes keyed by a human slug; each tags the formats it serves. `styleNotes` differ by shape class: ultra-wide leaderboard (320×50/728×90/970×90), wide billboard (970×250), rectangle (300×250), skyscraper (300×600) — each instructs center-safe composition for the eventual crop.

### 6.2 `src/lib/promptBuilder.ts` (extend)

Add `buildAdPrompt(input: BuildAdPromptInput): EnhancedPrompt` — mirrors `buildCampaignPrompt` but:
- keyed off `AdSizeDef` (not `PresetDef`);
- `aspectRatio = size.aspectRatio` (already nearest-mapped);
- intent string names the **ad placement + exact pixel size + crop-safe** intent ("designed to be center-cropped to {W}×{H}; keep subject and any copy within the central safe area, simple uncluttered background, generous bleed");
- reuses `brandLayer`/`referenceLayer`/`assemble`;
- optional `adCopy` via an ad-tuned copy layer (default: no baked text → `DEFAULT_NEGATIVE`; with copy → `CAMPAIGN_TEXT_NEGATIVE`).

No change to existing exports.

### 6.3 `src/lib/adCampaigns.ts` (new — mirrors `campaigns.ts`, no versions)

```ts
export type AdCampaignTile = {
  id: string; sizeId: string; width: number; height: number;
  aspectRatio: AspectRatio; workflowId: string; status: TileStatus;
  prompt: string; quantity: number; adCopy: AdCopy | null; assetUrl: string | null;
};
export type AdCampaign = {
  id: string; userId: string; title: string; brief: BriefForPresets;
  sizeIds: string[]; referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null; adCopy: AdCopy | null;
  tiles: AdCampaignTile[]; thumbUrl: string | null;
  estimatedBuzz: number; audience: string | null; aesthetics: string | null; createdAt: number;
};

createAdCampaign(input): Promise<AdCampaign>     // transactional campaign + tiles insert
getAdCampaign(userId, id): Promise<AdCampaign | null>   // resolves asset URLs
listAdCampaigns(userId): Promise<AdCampaign[]>          // desc(createdAt), resolves thumbs
deleteAdCampaign(userId, id): Promise<void>
updateAdCampaign(userId, id, patch: {title?}): Promise<...>
swapAdTileWorkflow(userId, campaignId, tileId, newWorkflowId): Promise<AdCampaignTile>  // regenerate
listAdCampaignAssets(userId, campaignId)               // done tiles + asset urls (for ZIP export)
```

### 6.4 `src/lib/assets.ts` (extend — surgical)
- Import `adCampaignTiles`.
- `syncAssetsFromSnapshot`: add a third lookup branch (after campaign, photoshoot) resolving `adCampaignTiles` by `workflowId`; on first asset, set `assetId/status='done'`.
- `markTileFailed`: add a third branch updating `adCampaignTiles`.

### 6.5 `src/lib/adExport.ts` (new — server-only)
Cropping happens **server-side** (no canvas cross-origin taint, mirrors the existing server-side `/api/campaigns/[id]/export`). Adds the `sharp` dependency (de-facto Node image lib; `fit:'cover'` does center-crop+scale to exact px).
- `cropToExactPng(bytes: Uint8Array | ArrayBuffer, width: number, height: number): Promise<Uint8Array>` — `sharp(buf).resize(width, height, { fit: 'cover', position: 'centre' }).png().toBuffer()`. **Unit-tested**: feed a generated solid PNG, assert output metadata is exactly W×H.
- Export ZIP reuses the existing `src/lib/zip.ts` `buildZipStored(entries: ZipEntry[])` (NOT raw jszip in the route).

## 7. API routes (new, under `src/app/api/ads/`)

### `POST /api/ads/cook` (mirrors campaigns/cook)
Body (Zod): `briefSchema` ∪ `{ sizeIds: string[] (1..6), referenceAssetIds?, adCopy?: AdCopy|null, enhancedPrompts? }`.
Flow: auth → `getUserKey` → `getDefaultBrand` → resolve refs (`getPublicUrls`, 400 on `MissingReferenceError`) → for each `sizeId`: `buildAdPrompt` → `VitrineImageGenInput { prompt, aspectRatio: size.aspectRatio, numImages:1, resolution:'2K', negativePrompt?, images? }` → `submitImageGen` (parallel, `Promise.allSettled`) → `createAdCampaign(successes)` → batch `recordGeneration({source:'ad_campaign', …})` + `recordBuzzEvent({kind:'estimate', note:'cook'})`. Returns `{ adCampaignId, partial?: failures }`. All-fail → 502/propagated status.

### `POST /api/ads/estimate` (mirrors campaigns/estimate)
Body: brief + sizeIds (+ optional adCopy). Builds prompts, calls `estimateImageGen` per size, returns `{ total, perSize: Record<sizeId, number> }`. Wizard surfaces cost before cook.

### `POST /api/ads/[id]/tiles/[tileId]/regenerate`
Body: `{ promptHint?, adCopy?, prompt? }`. Loads campaign + brand, rebuilds prompt (`buildAdPrompt` with hint/override), `submitImageGen`, `swapAdTileWorkflow`, audit (`recordGeneration` + `recordBuzzEvent` note `'regenerate'`). Returns `{ tile, workflowId }`.

### `GET /api/ads/[id]/export` (mirrors campaigns export, + crop)
Auth → `getAdCampaign` (404) → `listAdCampaignAssets` (409 if none) → for each done tile: `fetch(publicUrl)` server-side → `cropToExactPng(bytes, tile.width, tile.height)` → push `ZipEntry { name: '<sizeId>-<W>x<H>.png', data }` → `buildZipStored` → return `application/zip` attachment.

### `GET /api/ads/[id]/tiles/[tileId]/download` (single exact-px PNG)
Auth → load tile (404 / 409 if not done) → `fetch(asset)` → `cropToExactPng` → return `image/png` attachment named `<sizeId>-<W>x<H>.png`.

Workflow polling is the **existing** `/api/workflow/[id]` — unchanged. Terminal success runs `syncAssetsFromSnapshot` (now ad-aware); failure runs `markTileFailed` (now ad-aware).

## 8. Pages (new, `src/app/(app)/ads/`)
- `page.tsx` (RSC) → `listAdCampaigns(userKey)` → `<AdCampaignsList>`.
- `new/page.tsx` (RSC) → loads brand, assets, products, buzz account → `<AdCampaignWizard>`.
- `[id]/page.tsx` (RSC) → `getAdCampaign(userKey, id)` → `<AdCampaignDetail>`.

All under `(app)` → auth + onboarding gated automatically. 404 via `notFound()` when missing.

## 9. Components (new, `src/components/ads/`)
- `AdCampaignWizard.tsx` (client) — brief fields (reuse campaign brief inputs/patterns) → `AdSizePicker` → optional ad-copy toggle → cost preview (`/api/ads/estimate`) + buzz balance → submit `/api/ads/cook` → route to `/ads/[id]`.
- `AdSizePicker.tsx` — sizes grouped by format/device, each chip shows label + W×H + a mini aspect preview; default selection = `recommendedAdSizeIds()`.
- `AdCampaignsList.tsx` — grid of past ad campaigns (thumb, title, size count, cooking badge).
- `AdCampaignDetail.tsx` — header (editable title) + `AdCreativeGrid`.
- `AdCreativeCard.tsx` — polls `/api/workflow/[id]?wait=15000` until done; renders the generated image in a fixed-aspect box at the **exact target ratio** (`object-fit: cover`) so the preview matches the deliverable; download-exact-PNG link → `GET /api/ads/[id]/tiles/[tileId]/download`; regenerate dialog (prompt hint).
- `ExportAdCampaignButton.tsx` — downloads ZIP from `GET /api/ads/[id]/export` (mirror `ExportCampaignButton`).
- Reuse `generations/PollingCard` patterns where they fit.

## 10. Navigation
Add to `NAV` in `src/components/shell/nav.ts` after `photoshoot`:
`{ id: 'ads', label: 'ads', href: '/ads', icon: <lucide, e.g. Frame>, shortcut: '⌘4' }`.

## 11. Error handling
- Cook: per-size submit isolated via `allSettled`; partial success persists successes + returns `partial`. All-fail returns upstream status or 502. Invalid refs → 400. Unauthenticated → 401.
- Estimate failure is non-fatal in the wizard (show "estimate unavailable", allow cook).
- Crop/export: a failed single-image fetch is skipped in ZIP with a surfaced count; single download surfaces a toast on failure.
- Terminal-failed tiles show an error state + regenerate.

## 12. Testing
- **Unit** (`vitest`): `adFormats` (flatten correctness, the 6 sizes, `nearestAspect` table above, id stability), `cropToExactPng` (output metadata is exactly W×H for landscape/portrait/extreme targets, via `sharp`), `buildAdPrompt` (AR passthrough, copy on/off → negative prompt, crop-safe phrasing present).
- **E2E** (`playwright`, new `tests/e2e/70-ads.spec.ts`): cook an ad campaign against the MSW-mocked orchestrator → assert redirect to `/ads/[id]`, tiles transition cooking→done, exact-size download control present. Mirrors `50-campaigns`. MSW handlers already cover submit/estimate/workflow.
- **Verification commands:** `pnpm typecheck`; `pnpm db:generate` (review SQL) → `pnpm db:migrate` + `pnpm test:db:setup`; `pnpm test:unit`; `pnpm test:e2e`; `pnpm build`.

## 13. Risks / trade-offs
- **Heavy crop on leaderboards** (16:9 → 6–10:1) is lossy; mitigated by crop-aware prompting, accepted for MVP, flagged in UI. The real fix (text/logo overlay compositor + smarter source ratios) is the deferred top enhancement.
- **Baked prompt text** at tiny sizes is unreliable → ad copy is **off by default**; default deliverable is clean branded imagery, which literally satisfies "shows properly."
- **Shared-file edits** (`assets.ts`, `schema.ts`) touch code the campaigns/photoshoots paths rely on — additions only, covered by existing + new e2e to catch regressions.
- **Enum migration** (`generation_source` += `ad_campaign`) must land before any ad cook runs; sequenced first in the plan.
```
