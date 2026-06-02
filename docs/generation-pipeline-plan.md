# Generation Pipeline — Implementation Plan

> Wiring campaigns + photoshoots to real Civitai orchestrator generation with brand-DNA-enhanced prompts, reference images from the user's catalog/assets, a review step, and live progress on the detail page.

## TL;DR

- The cook routes already submit real workflows. Three things are missing: brand DNA in the prompt, reference image support, and a review step.
- The orchestrator has **no list endpoint** — we keep storing `workflow_id` per tile and treat the workflow snapshot as the source of truth for generated images. We do **not** mirror generated images to our own bucket.
- `assets` table now means **user-uploaded reference content only** (logos, products, manual uploads). Generated images live exclusively in the cached `generations.snapshot` JSON, fetched fresh from the orchestrator on demand.
- Multi-image batches use a single workflow per tile with a quantity field, not N tiles. One workflow ID, one buzz charge, one progress card with N rendered children.
- **All generation goes through one path:** `imageGen` step type with engine `google` and model `nano-banana-2`. Nano Banana 2 is multi-modal — same call shape with or without reference images.
- **Upscaling and video animation are post-generation actions**, performed against a completed image asset (not part of the initial cook). Separate UI + separate workflow submissions, billed separately.

## Decisions locked

| # | Decision | Rationale |
|---|---|---|
| 1 | Brand DNA enhancement is a server-side deterministic builder, not an LLM call | Predictable, free, testable. LLM rewrite is a later iteration if results feel flat. |
| 2 | Multi-image uses SDK `quantity`, not N tiles | One workflow = one buzz charge = one snapshot polled by one card. Tile schema gets a `quantity` column. |
| 3 | Review step shows the enhanced prompt read-only with an "edit raw prompt" override | User sees what we built; advanced users can override the final string. Edits trigger re-estimate. |
| 4 | Single generation path: `imageGen` step, engine `google`, model `nano-banana-2`, with optional `images: string[]` for references | Nano Banana 2 is multi-modal and produces brand-coherent product imagery with or without refs. One code path, one prompt format, predictable cost per image. No branching on refs presence. |
| 4b | Upscaling and video animation are **post-generation actions** on completed images, not part of the initial cook | Keeps the cook flow simple and cheap. User decides per-image whether to spend more buzz on hi-res or motion. Mirrors how Pomelli, Krea, and Civitai itself surface these. |
| 5 | Post-submit destination: detail page (`/campaigns/[id]`, `/photoshoot/[id]`) | Polling is already wired there; matches the Pomelli pattern. |
| 6 | Generated images are **not** mirrored to our object storage | Orchestrator has no list API but `getWorkflow(id)` returns the snapshot with image URLs. We cache the snapshot JSON in `generations.snapshot` and refresh on demand if `available: false`. |
| 7 | Drop the photoshoot outer `variantsPerTemplate` loop in favor of `quantity` per template tile | One tile per template, N images per tile. Better UX, half the tile rows, same output. Existing photoshoot rows in dev DB are throwaway — no migration of historical data. |
| 8 | Users select assets to include in generated images via a catalog/asset picker | Confirmed requirement. Picker covers products (from catalog) and assets (uploads). |

## Architecture overview

```
┌─────────────────────┐         ┌─────────────────────┐
│ /campaigns/new      │  step 1 │ pick brief +        │
│ wizard (3 steps)    │ ──────► │ assets + variants   │
└─────────────────────┘         └─────────────────────┘
          │                              │
          │ step 2: preview              ▼
          │            POST /api/campaigns/preview
          │              → buildCampaignPrompt(brief, brandDna, preset)
          │              → estimateWorkflow per preset (parallel)
          │              → return {enhancedPrompts, estimatePerPreset, totalBuzz}
          │
          │ user reviews enhanced prompts, may override raw text
          │ → re-POSTs preview on edit (debounced) for fresh estimate
          │
          │ step 3: submit
          ▼
   POST /api/campaigns/cook
     → re-estimate per preset (covers stale-preview)
     → submitImageGen({engine:'google', model:'nano-banana-2', prompt, images?, ...})
     → persist campaign + tiles + generations + buzz events
     → 303 to /campaigns/[id]

/campaigns/[id]
  → renders CampaignDetail with one CreativeCard per tile
  → CreativeCard long-polls /api/workflow/[id]?wait=15000
  → on each poll, updates generations.snapshot in DB
  → renders all images from extractImageUrls(snapshot)
  → quantity skeletons before first image lands
```

Photoshoot mirrors the same shape with template picker instead of preset picker and product-name fields instead of campaign brief.

## Schema changes

`src/lib/db/schema.ts`:

```ts
campaigns:
  + referenceAssetIds: text('reference_asset_ids').array().notNull().default([])
  + variantsPerPreset: integer('variants_per_preset').notNull().default(1)
  + enhancedPrompts: jsonb('enhanced_prompts').$type<Record<PresetId, EnhancedPrompt>>()

photoshoots:
  + referenceAssetIds: text('reference_asset_ids').array().notNull().default([])
  + variantsPerTemplate: integer  -- already exists; semantic changes (now = SDK quantity)
  + enhancedPrompts: jsonb('enhanced_prompts').$type<Record<PhotoshootTemplateId, EnhancedPrompt>>()

campaign_tiles:
  + quantity: integer('quantity').notNull().default(1)
  - assetId: drop (or keep nullable for legacy)

photoshoot_tiles:
  + quantity: integer('quantity').notNull().default(1)
  - assetId: drop (or keep nullable for legacy)

generations:
  + source: text -- existing 'campaign'|'photoshoot'; add 'upscale'|'animate' values to the enum/check constraint
  + parentWorkflowId: text -- nullable; for upscale/animate, points to the original gen's workflow_id
  + parentImageIndex: integer -- nullable; the index in extractImageUrls(parentSnapshot) that this derives from
  + mediaType: text -- 'image' (default) or 'video' for animate outputs
  (snapshot jsonb already holds the full WorkflowSnapshot — no change there)
```

`EnhancedPrompt` type (new, in `src/lib/promptBuilder.ts`):

```ts
type EnhancedPrompt = {
  base: string;          // user brief / product description
  brandLayer: string;    // brand dna injection (tone, palette refs, tagline)
  styleLayer: string;    // preset/template styleNotes
  finalPrompt: string;   // assembled string sent to orchestrator
  negativePrompt: string;
  userOverride?: string; // if set, this is what we send instead of finalPrompt
};
```

Migration: `pnpm db:generate` → review SQL → `pnpm db:migrate` → `pnpm test:db:setup`.

## New / changed files

### Library

- **`src/lib/promptBuilder.ts`** (new) — pure functions, no I/O.
  - `buildCampaignPrompt({brief, brandDna, preset, referenceCount}): EnhancedPrompt`
  - `buildPhotoshootPrompt({brief, brandDna, template, referenceCount}): EnhancedPrompt`
  - Brand DNA layer composition: `"brand: {name} ({industry}). tone: {tone}. tagline: '{tagline}'. palette accents: {palette[0..2]}. mood aligned with: {description summary}"`. Tasteful, not stuffed. Trimmed to ~200 chars to keep within prompt budget.
  - Reference layer (when refs present): `"composition references provided ({referenceCount} images) — preserve product fidelity and silhouette"`.

- **`src/lib/civitai.ts`** (modify) — replace existing text-to-image helpers with `imageGen` path:
  - Add `DEFAULT_IMAGE_ENGINE = 'google'` and `DEFAULT_IMAGE_MODEL = 'nano-banana-2'` exported constants (overridable per call).
  - `estimateImageGen(session, input: VitrineImageGenInput): Promise<WorkflowSnapshot>` — wraps `buildImageGenBody({engine, model, prompt, images?, aspectRatio, numImages, resolution})` then `estimateWorkflow`.
  - `submitImageGen(session, input: VitrineImageGenInput): Promise<WorkflowSnapshot>` — same body, `submitWorkflow`.
  - `VitrineImageGenInput = { prompt, negativePrompt?, images?: string[], aspectRatio: '1:1'|'4:5'|'9:16'|'16:9', numImages: number, resolution?: '1K'|'2K' }` — single shape, refs optional.
  - Add `submitUpscale(session, sourceImageUrl): Promise<WorkflowSnapshot>` — wraps `buildWorkflowBody({$type: 'imageUpscaler', input: {image: sourceImageUrl, scale: 2}})`.
  - Add `submitVideoAnimate(session, sourceImageUrl, prompt?): Promise<WorkflowSnapshot>` — wraps `buildWorkflowBody({$type: 'videoGen', input: {engine: 'wan'|tbd, model: 'image-to-video', sourceImage, prompt}})` — pick exact engine/model after a smoke test, since `videoGen` is engine-specific like `imageGen`.
  - Add matching `estimate*` variants for both post-gen actions so the UI can show buzz cost before user confirms.
  - Delete `estimateGeneration`/`submitGeneration` (text-to-image wrappers) — they go away with the single-path switch. Update existing call sites in the same workstream.

- **`src/lib/assets.ts`** (modify):
  - `getPublicUrls(assetIds: string[]): Promise<string[]>` — resolves to URLs the orchestrator can `GET`. If bucket is not public, returns long-TTL presigned GET URLs (24h+). Confirm bucket policy on first run.
  - Remove / deprecate `syncAssetsFromSnapshot` for orchestrator outputs. Keep it only if we ever need to mirror — flagged for deletion.

- **`src/lib/generations.ts`** (modify):
  - `refreshGenerationSnapshot(workflowId, session): Promise<WorkflowSnapshot>` — calls `getWorkflow`, persists fresh snapshot to `generations.snapshot`. Called from detail page server component if cached snapshot is stale (>10 min) or `available: false` on any image.

### API routes

- **`POST /api/campaigns/preview`** (new)
  - Body: `{brief, presetIds, variantsPerPreset, referenceAssetIds}`
  - Returns: `{enhancedPrompts, estimatePerPreset, totalBuzz}`
  - No persistence.

- **`POST /api/photoshoot/preview`** (new) — symmetric.

- **`POST /api/campaigns/cook`** (modify)
  - Body adds: `enhancedPrompts` (from preview, possibly with `userOverride`), `referenceAssetIds`, `variantsPerPreset`.
  - Per preset: resolve `referenceAssetIds` → public URLs → `submitImageGen({engine: 'google', model: 'nano-banana-2', prompt, images, aspectRatio, numImages})`. Single path, no branching.
  - Persist tile with `quantity = variantsPerPreset`.

- **`POST /api/photoshoot/cook`** (modify) — symmetric. Outer `variantsPerTemplate` loop removed; passed as `numImages`.

- **`POST /api/campaigns/[id]/tiles/[tileId]/regenerate`** (modify) — preserves refs + quantity; rebuilds prompt; bumps seed/variation hint in prompt.

- **`POST /api/generations/[workflowId]/images/[index]/upscale`** (new) — post-gen action.
  - Validates workflow belongs to user.
  - Reads `extractImageUrls(snapshot)[index]` as source.
  - Calls `submitUpscale(session, sourceUrl)`.
  - Inserts a new `generations` row with `source = 'upscale'`, `parentWorkflowId = original`, returns workflow ID.
  - Client polls `/api/workflow/[id]` same as initial gen.

- **`POST /api/generations/[workflowId]/images/[index]/animate`** (new) — post-gen action, image-to-video.
  - Same shape as upscale: source URL → `submitVideoAnimate(session, sourceUrl, optionalPrompt)`.
  - New `generations` row with `source = 'animate'`, output media type `video`.

- **`GET /api/workflow/[id]?wait=...`** (modify) — already updates `generations` on terminal. Stop calling `syncAssetsFromSnapshot`; instead just keep `generations.snapshot` current. Handle both image and video outputs (videoGen workflows return blobs/URLs in the same snapshot shape, possibly under `output.blobs[]` with `mimeType: 'video/mp4'`).

### UI

- **`src/components/pickers/AssetCatalogPicker.tsx`** (new)
  - Tabbed: "Products" (from `/api/catalog/products`) and "Assets" (from `/api/assets`)
  - Grid of thumbnails with multi-select checkmark
  - Controlled component: `value: string[]`, `onChange: (ids: string[]) => void`
  - Optional: `max` cap to prevent oversized reference sets (default 4)

- **`src/app/(app)/campaigns/new/page.tsx` + `src/components/campaigns/CampaignWizard.tsx`** (new wizard)
  - 3 steps, step state in URL `?step=brief|review|submit`
  - Step 1: existing `BriefForm` fields + new `AssetCatalogPicker` + variants-per-preset stepper + preset grid
  - Step 2: per-preset card showing `EnhancedPrompt`, collapsible "what we added from your brand", "edit raw prompt" textarea toggle, ratio, estimated buzz per preset, total
  - Step 3: single CTA "cook N creations for X buzz"

- **`src/app/(app)/photoshoot/new/page.tsx` + `src/components/photoshoot/PhotoshootWizard.tsx`** (new wizard) — same shape, photoshoot fields.

- **`src/components/campaigns/CreativeCard.tsx`** (modify)
  - Render N skeleton placeholders when `tile.quantity > 1` before any image arrives
  - Render all images from `extractImageUrls(snapshot)`, not just the first
  - Carousel or grid layout for multi-image tiles
  - Per-image action menu (hover or click overlay): **Upscale 2×** · **Animate (video)** · **Download** · **Regenerate**
  - Action buttons show the buzz cost preview before confirming
  - On Upscale/Animate click → POST to the relevant `/api/generations/.../upscale|animate` endpoint → render an inline child card under the source image that polls the new workflow and reveals the upscaled image or video player when terminal

- **`src/components/photoshoot/PhotoshootResults.tsx`** (modify) — same multi-image rendering + same per-image action menu.

- **`src/components/generations/PostGenActions.tsx`** (new, shared) — small component that renders the Upscale / Animate action buttons + their loading/result states. Used inside `CreativeCard` and `PhotoshootResults` so we don't duplicate logic.

## Buzz preview correctness

Today `/campaigns/new` shows `8 + presetIds.length * 6`, fabricated.

After this work:
- Preview route calls real `estimateWorkflow` per preset in parallel and returns the sum.
- Cook route re-estimates immediately before submitting (covers the case where Buzz pricing changed between preview and submit).
- `recordBuzzEvent('estimate')` on preview, `recordBuzzEvent('submit')` on cook — matches existing audit pattern.

## Post-generation actions (upscale & animate)

Both run **after** the initial cook completes. They take a single completed image (one of N from a tile's snapshot) and submit a new workflow against it. The user decides per-image whether to spend more buzz.

### UX

On each rendered image inside `CreativeCard` / `PhotoshootResults`, a hover/click overlay reveals action chips:

```
┌────────────────────────────┐
│                            │
│      [generated image]     │
│                            │
│  ┌──────────────────────┐  │
│  │ ↑ Upscale 2× · N buzz│  │ ← hover overlay
│  │ ▶ Animate · M buzz   │  │
│  │ ⬇ Download           │  │
│  │ ↻ Regenerate         │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

Clicking Upscale or Animate:
1. Shows the buzz cost (already estimated when the overlay opened — pre-fetched estimate).
2. User confirms.
3. POST to `/api/generations/[workflowId]/images/[index]/upscale` (or `/animate`).
4. Server submits a new orchestrator workflow, creates a `generations` row with `source = 'upscale'|'animate'`, `parentWorkflowId = original`, returns the new workflow ID.
5. UI renders an inline child card below the source image (or expands the source image into a "before/after" pair) that long-polls `/api/workflow/[id]` exactly like a fresh tile.
6. When terminal: upscaled image swaps in (2× resolution), or video player appears with the animated clip.

### Server flow

```
                       source image
                       url + workflow_id
                              │
                              ▼
         ┌────────────────────────────────────┐
         │ POST /api/generations/.../upscale  │
         │ POST /api/generations/.../animate  │
         └────────────────────────────────────┘
                              │
                              ▼
              validate ownership (generations table)
                              │
                              ▼
              extractImageUrls(snapshot)[index]
                              │
                              ▼
              submitUpscale OR submitVideoAnimate
                              │
                              ▼
              insert generations row
              + recordBuzzEvent('estimate')
              + recordBuzzEvent('submit')
                              │
                              ▼
              return {workflowId, estimatedBuzz}
                              │
                              ▼
              client polls /api/workflow/[id]
                              │
                              ▼
              on terminal → snapshot persisted, UI updates
```

### Why post-gen, not part of cook

- **Cost transparency.** Upscale + animate are 5–20× the cost of base generation. Forcing them as part of the cook would balloon the preview total and discourage submission.
- **Quality-first.** User picks their favorite image from N variants, then invests buzz on that one. Matches Pomelli / Krea / Civitai's own flow.
- **Reusable.** Same surface works for any future post-gen action (background remove, outpaint, restyle).

### What lives in the DB

`generations` rows for post-gen actions:
- `source`: `'upscale'` or `'animate'`
- `parentWorkflowId`: the cooking workflow this derived from
- `sourceId`: the campaign/photoshoot id (carried through from parent)
- `tileId`: the tile that owns the source image
- `snapshot`: the new workflow's snapshot, polled fresh
- `mediaType`: `'image'` for upscale, `'video'` for animate

No new tile rows. The UI links derived generations to their source image by parentWorkflowId + image index (stored on the new `generations` row as `parentImageIndex: number`).

## Image lifecycle

We do **not** mirror generated images to our R2/MinIO. Source of truth:

1. **Workflow ID** in `campaign_tiles.workflowId` / `photoshoot_tiles.workflowId` — persistent.
2. **Cached snapshot** in `generations.snapshot` (jsonb) — updated on every poll terminal state and on demand.
3. **Image URLs** read from `extractImageUrls(snapshot)`. If any `images[i].available === false`, the detail page server triggers `refreshGenerationSnapshot(workflowId)` to fetch a fresh snapshot from the orchestrator.

User-uploaded reference images (logos, products, manual uploads) **are** stored in our object storage as before, with `assets` rows pointing to them. The orchestrator fetches references via the public URLs we provide.

If the orchestrator ever drops a workflow entirely (404 on `getWorkflow`), we surface an "image expired — regenerate" CTA on the tile. We don't try to silently re-cook.

## Testing strategy

Existing infrastructure: **vitest** for unit tests (colocated `*.test.ts`), **Playwright** for e2e (`e2e/NN-*.spec.ts`), **MSW** for mocking the Civitai orchestrator + Civitai API in node (`src/mocks/handlers.ts`, gated on `MOCK_CIVITAI=1`). Isolated test DB via `pnpm test:db:setup`.

Every workstream below ships with its own tests. No code lands without them.

### Unit tests (vitest, colocated)

- **`src/lib/promptBuilder.test.ts`** (workstream B)
  - `buildCampaignPrompt` with and without brand DNA fields populated (covers null tagline, null palette, etc.)
  - Brand layer character budget — never exceeds ~200 chars
  - `userOverride` short-circuits `finalPrompt` assembly
  - `referenceCount > 0` injects the reference layer, `0` omits it
  - Snapshot-style assertion on the assembled `finalPrompt` for each preset and template (locks brand voice consistency)

- **`src/lib/civitai.test.ts`** (workstream C)
  - `estimateImageGen` and `submitImageGen` build the right `imageGen` body (engine `google`, model `nano-banana-2`, correct `aspectRatio`/`numImages`/`images` fields)
  - `submitUpscale` builds an `imageUpscaler` step with the source URL
  - `submitVideoAnimate` builds a `videoGen` step with source image + chosen engine
  - Each helper threads the session's access token into `createOrchestratorClient`
  - Error path: orchestrator 402 (insufficient buzz) surfaces as a typed `OrchestratorError`

- **`src/lib/assets.test.ts`** (workstream C)
  - `getPublicUrls` returns public URLs when bucket policy allows; falls back to presigned GETs with ≥24h TTL otherwise
  - Resolves correctly for both `products` and `assets` ids
  - Throws on unknown asset id (no silent string interpolation of a missing record)

- **`src/lib/generations.test.ts`** (workstream A)
  - `recordGeneration` writes correct columns for `source: 'campaign'|'photoshoot'|'upscale'|'animate'`
  - `parentWorkflowId` + `parentImageIndex` round-trip for post-gen rows
  - `refreshGenerationSnapshot` updates the cached snapshot and bumps `updatedAt`

### Route-handler tests (vitest, in-process)

These run with MSW intercepting outbound orchestrator calls. They use the test DB and a stub session helper.

- **`src/app/api/campaigns/preview/route.test.ts`** (workstream D)
  - Returns `{enhancedPrompts, estimatePerPreset, totalBuzz}` for a valid brief
  - Calls `estimateWorkflow` once per preset, in parallel (assert with MSW request log)
  - Surfaces per-preset errors without failing the whole request
  - Records a `recordBuzzEvent('estimate')` row per preset
  - 401 when session missing; 400 on schema failure

- **`src/app/api/campaigns/cook/route.test.ts`** (workstream E)
  - Persists campaign + tiles + generations + buzz events in one transaction
  - One workflow per preset; `quantity = variantsPerPreset` propagated
  - `referenceAssetIds` resolve to URLs and land in `images[]` on the orchestrator body
  - `userOverride` on a preset replaces `finalPrompt` for that preset only
  - Rollback when orchestrator submit fails mid-batch (no orphan tiles)

- **`src/app/api/photoshoot/preview/route.test.ts`** + **`cook/route.test.ts`** (workstreams D + E) — symmetric coverage.

- **`src/app/api/generations/[workflowId]/images/[index]/upscale/route.test.ts`** (workstream K)
  - Ownership check: 403 when workflow belongs to a different user
  - 404 when image index is out of range for the parent snapshot
  - On success: new `generations` row with `source='upscale'`, `parentWorkflowId`, `parentImageIndex`, `mediaType='image'`
  - Buzz events recorded

- **`src/app/api/generations/[workflowId]/images/[index]/animate/route.test.ts`** (workstream K) — symmetric, asserts `mediaType='video'`.

- **`src/app/api/workflow/[id]/route.test.ts`** (workstream I)
  - Terminal `succeeded` triggers `updateGenerationFromSnapshot` + buzz `submit` charge
  - Terminal `failed` calls `markTileFailed`, does not record submit charge
  - Stops calling the deprecated `syncAssetsFromSnapshot` (regression guard)

### Component tests (vitest + @testing-library/react)

- **`src/components/pickers/AssetCatalogPicker.test.tsx`** (workstream F)
  - Renders tabs, switches between Products and Assets
  - Multi-select toggles update controlled `value`
  - Respects `max` cap, disables remaining checkboxes when reached
  - Empty state when no products and no assets exist

- **`src/components/generations/PostGenActions.test.tsx`** (workstream K)
  - Shows buzz cost on hover/open (mocks an estimate fetch)
  - Disables Animate when source is already a video
  - Click flow: confirm → POST → poll → renders child card

### E2E tests (Playwright, against MSW-mocked orchestrator)

MSW handlers in `src/mocks/handlers.ts` extended to cover `imageGen` (nano-banana-2), `imageUpscaler`, `videoGen`. Each handler returns a believable `WorkflowSnapshot` progression (`pending → processing → succeeded`) so polling works end-to-end.

- **`e2e/50-campaigns.spec.ts`** (workstream J, modify existing)
  - Brief → asset picker (select 1 product) → review → see enhanced prompt + brand layer disclosure → adjust variants → buzz total updates → submit → land on `/campaigns/[id]` → tiles show skeletons → tiles populate with N images each
  - Override the raw prompt on one preset, confirm it lands in the submit body

- **`e2e/60-photoshoot.spec.ts`** (workstream J, modify existing) — symmetric flow with template picker + ratio chips.

- **`e2e/70-postgen.spec.ts`** (workstream J, new)
  - From a completed campaign tile, hover an image → click Upscale → confirm cost → child card polls → upscaled image renders
  - Same image → click Animate → child card polls → video player renders with controls
  - Cost preview shown before submission in both cases

- **`e2e/99-generation.spec.ts`** (workstream J, extend existing)
  - Smoke pass over the full pipeline (preview → cook → poll → upscale → animate) using deterministic MSW responses

### Mock handlers to add (`src/mocks/handlers.ts`)

- `POST /v2/consumer/workflows` matching `step.$type === 'imageGen'` with `engine: 'google'`, `model: 'nano-banana-2'` — return snapshot with `numImages` placeholder image URLs
- `POST /v2/consumer/workflows` matching `step.$type === 'imageUpscaler'` — return snapshot with one upscaled URL
- `POST /v2/consumer/workflows` matching `step.$type === 'videoGen'` — return snapshot with a blob `mimeType: 'video/mp4'`
- `GET /v2/consumer/workflows/:id` progression handler that flips `status` from `pending` → `processing` → `succeeded` across consecutive polls (so long-poll tests verify the loop actually advances)

### CI gates (`pnpm` scripts to chain in CI)

```
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db:setup
pnpm test:e2e
```

Each workstream's PR must pass the first three locally. E2E runs on merge to a feature integration branch before any merge to `main`.

### What we explicitly skip

- Real orchestrator hits in CI — too flaky, too expensive in buzz. MSW only.
- Visual regression / screenshot diffing — out of scope for v1. Add later if drift becomes a problem.
- Load testing of the long-poll endpoint — single-tenant for now.

## Workstream breakdown for divide-and-conquer

Dependencies in parens. Each can be a separate branch/PR.

| # | Workstream | Deps | Touches |
|---|---|---|---|
| **A** | Schema + migration + tile.quantity plumbing | — (blocks B/D/E) | `db/schema.ts`, drizzle migrate, `lib/campaigns.ts`, `lib/photoshoots.ts`, `lib/generations.ts` |
| **B** | `promptBuilder.ts` + brand DNA composition + unit tests | A (for types) | `lib/promptBuilder.ts`, new test file under `tests/unit/` |
| **C** | `imageGen` SDK wrapper + asset public-URL resolver | — | `lib/civitai.ts`, `lib/assets.ts`, possibly `lib/s3.ts` for presigned GETs |
| **D** | Preview routes (campaigns + photoshoots) | B + C | `app/api/campaigns/preview/route.ts`, `app/api/photoshoot/preview/route.ts` |
| **E** | Cook route updates (refs, quantity, step type switch, override) | A + C | `app/api/campaigns/cook/route.ts`, `app/api/photoshoot/cook/route.ts`, `app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts` |
| **F** | `AssetCatalogPicker` component | — | `components/pickers/AssetCatalogPicker.tsx` |
| **G** | Campaign wizard (brief → review → submit) | D + F | `app/(app)/campaigns/new/page.tsx`, `components/campaigns/CampaignWizard.tsx`, `components/campaigns/BriefForm.tsx` |
| **H** | Photoshoot wizard | D + F | `app/(app)/photoshoot/new/page.tsx`, `components/photoshoot/PhotoshootWizard.tsx`, `components/photoshoot/PhotoshootBuilder.tsx` |
| **I** | Detail-page multi-image rendering + skeletons + snapshot refresh | A | `components/campaigns/CreativeCard.tsx`, `components/photoshoot/PhotoshootResults.tsx`, possibly `app/api/workflow/[id]/route.ts` |
| **K** | Post-gen actions: upscale + animate (server routes + UI component) | A + C + I | `lib/civitai.ts` (post-gen wrappers), `app/api/generations/[workflowId]/images/[index]/upscale/route.ts`, `app/api/generations/[workflowId]/images/[index]/animate/route.ts`, `components/generations/PostGenActions.tsx` |
| **J** | E2E specs + MSW handler extensions (per the Testing strategy section) | All others | `e2e/50-campaigns.spec.ts`, `e2e/60-photoshoot.spec.ts`, new `e2e/70-postgen.spec.ts`, `e2e/99-generation.spec.ts`, `src/mocks/handlers.ts` |

Suggested order for one-person execution: **A → C → B → D → E → F → G/H (parallel) → I → K → J**.

## Open questions to resolve during implementation

1. **MinIO/R2 bucket public-read?** If not, `lib/s3.ts` needs a `presignGet(key, ttl)` helper and we feed those URLs to the orchestrator. Confirm bucket policy in the first commit of workstream C.
2. **Should the brand logo auto-attach as a reference for every campaign?** Currently the plan treats refs as opt-in via the picker. Auto-attaching the logo is a separate, easy extension once C lands.
3. **Cost ceiling per campaign?** Should the preview block submission above a buzz threshold (e.g., > user's current balance)? Today the cook route would just fail at orchestrator submit. Worth surfacing nicely in the wizard.
4. **Regenerate UX for photoshoots** — currently photoshoots have no regenerate button on tiles. Add one, or leave for v2?
5. **Nano Banana 2 exact field names** — the SDK accepts `engine: 'google'`, `model: 'nano-banana-2'`, `prompt`, `images`, `aspectRatio`, `numImages`, `resolution` based on what we've seen. Run a quick `estimateWorkflow` smoke test in workstream C against the dev orchestrator with one image and confirm the field set; adjust `VitrineImageGenInput` if anything else is required (e.g., `safetyLevel`, `personGeneration`).
6. **Video animation engine choice** — `videoGen` step is engine-specific (likely `wan` or `kling` or `runway` based on the engine catalog). Pick one in workstream K after a smoke estimate. Image-to-video typically takes 30–120s and costs significantly more buzz than image gen; surface the cost prominently on the Animate action.

## Phase 2: Ad-hoc generation from the assets page (txt2img)

After the campaign + photoshoot pipelines are live, the next surface to wire is **freeform text-to-image generation** launched from the assets page. This is for users who want a one-off image without going through a brief/preset wizard — pure prompt-driven creation that lands directly in the user's asset library.

### Trigger

- New **"+ Generate"** button next to the existing **"+ Upload"** CTA on `/brand/assets` (in `AssetsGallery` header).
- Click opens a modal (or routes to `/brand/assets/generate`). Decide once the wizard pattern is reused — modal is faster, page is shareable. Default: modal.

### Form fields

| Field | Required | Notes |
|---|---|---|
| `prompt` | yes | Textarea, `.max(4000)`. Single source of truth for what to generate. |
| `negativePrompt` | no | Textarea, defaults to the same `DEFAULT_NEGATIVE` from `promptBuilder.ts`. |
| `aspectRatio` | yes | Chip group: `1:1`, `4:5`, `9:16`, `16:9`. Default `1:1`. |
| `numImages` | yes | Stepper 1–4. Default 1. (Lower cap than campaign/photoshoot — solo gen is exploratory.) |
| `resolution` | no | `1K` / `2K` toggle. Default `1K`. |
| `referenceAssetIds` | no | Optional `AssetCatalogPicker` reuse (same component). When set, falls back to img2img via Nano Banana 2's multi-modal mode — same code path as campaign refs. |

No brand DNA injection here. Ad-hoc generation is intentionally raw — user types exactly what they want and gets it. Brand DNA injection is a campaign/photoshoot concern.

### Server flow

**New route: `POST /api/assets/generate`**

```
1. validate body with zod (above schema)
2. getSession + getUserKey
3. if referenceAssetIds: getPublicUrls(userKey, ids) → urls
4. estimate first? optional — just submitImageGen with the same payload and read submit.cost.total
5. submitImageGen({
     engine: 'google',
     model: 'nano-banana-2',
     prompt,
     negativePrompt,
     aspectRatio,
     numImages,
     resolution,
     ...(refUrls.length ? { images: refUrls } : {}),
   })
6. recordGeneration({
     workflowId, userId: userKey,
     source: 'adhoc',          // already in the enum
     sourceId: null,            // no campaign/photoshoot parent
     tileId: null,
     prompt, input, estimatedBuzz,
   })
7. recordBuzzEvent({ ..., kind: 'estimate', note: 'adhoc' })
8. return { workflowId, estimatedBuzz }
```

The submit-time charge audit is recorded by the existing `/api/workflow/[id]` polling endpoint on terminal success — same path as every other gen.

### Client flow + polling

1. User submits → modal shows inline loading state.
2. Client receives `{workflowId, estimatedBuzz}`.
3. Client long-polls `/api/workflow/[id]?wait=15000` exactly like a campaign tile.
4. On terminal success, snapshot has `images[]` URLs.
5. Modal pivots to a results view: grid of generated images, each with **"Save to assets"** + **"Discard"**.
6. **"Save to assets"** → `POST /api/assets/generate/save` (or a flag on the original route — TBD) that:
   - Looks up the `generations` row by workflowId, validates ownership.
   - For each chosen image index: creates a new `assets` row (`kind: 'generated'`, `ownerType: 'user'`, `workflowId`, `publicUrl` from the snapshot).
   - We **do** mirror the chosen images to our R2 in this flow — once the user commits to keeping the output, we copy from the orchestrator URL to our storage so the asset is durable (orchestrator can GC). Unsaved outputs stay snapshot-only and may expire.

### What lands in the DB

| Table | New row | Notes |
|---|---|---|
| `generations` | one row, `source: 'adhoc'` | parent linkage absent. snapshot cached. |
| `assets` | N rows (one per *saved* image) | `kind: 'generated'`, `userId`, `workflowId`, `publicUrl` (mirrored to R2), `metadata: { generation: { workflowId, imageIndex, prompt } }` |
| `buzz_events` | 2 rows | `estimate` at cook, `submit` at workflow terminal |

Unsaved images leave no asset rows — only the cached `generations.snapshot` references them. They're effectively ephemeral previews.

### Why mirror here but not for campaign/photoshoot

Campaign/photoshoot outputs are always tied to a `*_tiles.workflowId` and re-fetchable via the orchestrator. The user reasons about them as "the campaign", not "individual images" — they regenerate the tile if they need refresh. Ad-hoc generation is the opposite: the user picks their favorite, calls it an asset, and treats it like an upload. The mental model demands durability. The extra storage cost is acceptable because the asset is now first-class and will be referenced from products, brand collections, etc.

### Workstream breakdown (Phase 2)

| # | Workstream | Deps | Touches |
|---|---|---|---|
| **L** | Modal/component: `AdHocGenerationModal` (or page) — prompt + aspect + count + optional refs | F (AssetCatalogPicker reuse) | `src/components/assets/AdHocGenerationModal.tsx`, modification to `AssetsGallery.tsx` to add the "+ Generate" CTA |
| **M** | API route: `POST /api/assets/generate` | C (image-gen helpers), I (polling already works) | `src/app/api/assets/generate/route.ts`, route test |
| **N** | API route: save selected outputs to assets — mirror to R2, create asset rows | M, lib/s3.ts | `src/app/api/assets/generate/save/route.ts`, new helper `lib/assetMirror.ts` for copy-from-orchestrator-to-R2 |
| **O** | E2E spec: ad-hoc generate → poll → save | L + M + N | `e2e/80-adhoc-generation.spec.ts`, MSW handlers already cover imageGen |

Suggested order: M → L → N → O. Independent of any Phase 1 workstream.

### Buzz cap consideration

Same `MAX_PROMPT_CHARS` and quantity caps as campaign. Add: enforce a per-user-per-minute generation count limit at the route level (`5/min` is a reasonable starting point) so a user spamming the modal doesn't accidentally drain their balance. Defer to Phase 1's broader rate-limit work if it lands first.

### What this does *not* cover (Phase 2)

- Saving to a specific brand profile or product — that's a follow-up.
- "Variations" button (re-run with same prompt + new seed) — defer; user can just resubmit.
- LoRA/checkpoint selection — Nano Banana 2 only for v1.

## What this does *not* cover

- LLM-based prompt enhancement (`promptEnhancement` step) — explicitly deferred. The deterministic builder ships first; we can swap in an LLM step later without changing schema.
- Brand DNA voice rewrite (rewriting brief copy in brand tone) — separate feature.
- Image edit / inpainting flows — out of scope.
- Webhook-based progress updates — orchestrator doesn't offer this; long-poll stays.
- Safety filtering via `xGuardModeration` — could chain after each `imageGen` step for nsfw screening; deferred but worth revisiting before shipping to real users.
- LoRA training on user's brand assets (`imageResourceTraining`) — future feature; would let us fine-tune nano-banana or an SDXL checkpoint on a user's product line for higher fidelity.
