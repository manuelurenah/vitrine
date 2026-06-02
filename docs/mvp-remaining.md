# MVP Remaining — vitrine

Status snapshot as of 2026-06-02. Demo deadline approaching. Goal: close every item below before ship. Items are ordered by demo impact (top = blocker, bottom = nice-to-have). Each item lists files + acceptance criteria so any session can pick it up cold.

## Verification gates (run after every batch)

- `pnpm typecheck` — must pass
- `pnpm vitest run` — current baseline 305/305 pass
- `pnpm build` — must succeed
- `pnpm test:e2e` — Playwright suite (needs Civitai dev server + OAuth app — see README)

---

## 🔴 Blockers — user-visible dead ends

### 1. Photoshoot regenerate missing

**Files to add/modify:**
- `src/app/api/photoshoot/[id]/tiles/[tileId]/regenerate/route.ts` — mirror `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts` (same shape: ownership check via `getPhotoshoot`, rebuild input from stored brief + template, `submitImageGen`, `recordGeneration`, `recordBuzzEvent`, return new `workflowId`).
- `src/lib/photoshoots.ts` — likely needs a `getPhotoshootTile` analog to `getCampaignTile` if not already there. Verify.
- `src/components/photoshoot/PhotoshootResults.tsx` — thread `regenerate={{ photoshootId, tileId }}` into `<CreativeCard>` (currently passes nothing).
- `src/components/campaigns/CreativeCard.tsx` — `RegenerateContext` type currently `{ campaignId, tileId }`. Generalize to `{ kind: 'campaign' | 'photoshoot'; id; tileId }` or accept either shape; fetch URL switches on kind.

**Acceptance:** click regen on a photoshoot tile, new workflow polls live, terminal state renders new images. Test added in `src/app/api/photoshoot/[id]/tiles/[tileId]/regenerate/route.test.ts` mirroring the campaign test.

### 2. Mic icon in `PromptComposer` is dead UI

**File:** `src/components/campaigns/PromptComposer.tsx`

**Decision:** drop the button (no speech-to-text in MVP). It's at lines 82-87. Remove the `Mic` import too.

**Acceptance:** no orphan dead button on the campaigns landing page.

### 3. Fabricated `briefCostBuzz = 8`

**File:** `src/components/campaigns/PromptComposer.tsx`

The `· 8 buzz` suffix on the "generate brief" button is made up. Either:
- drop it entirely (wizard's real estimate appears on step 2); or
- replace with a quick `/api/campaigns/estimate`-style endpoint call on debounce.

Simpler: drop. Keep the button text `generate brief`.

**Acceptance:** no fake numbers shown on the composer button.

### 4. Wizard hardcoded defaults

**File:** `src/components/campaigns/CampaignWizard.tsx`

`DEFAULT_BRIEF` (line 63) and `DEFAULT_PROMPT` (line 60) are chili-oil copy. User without `?prompt=` lands on prefilled fake brand. Either:
- blank defaults (`title: '', description: '', prompt: ''`); wizard already enforces non-empty title+description at line 150.
- conditionally use defaults only when no brand DNA + no URL params.

**Acceptance:** fresh wizard (no URL params) shows empty fields, not stale chili-oil text.

---

## 🟡 Polish

### 5. Buzz balance check before submit

Plan open question #3. Cook route currently fails at orchestrator 402 if balance insufficient. Surface upfront.

**Files:**
- `src/lib/civitai.ts` — already has a buzz fetch (`fetchBuzzBalance` or similar). Verify.
- `src/components/campaigns/CampaignWizard.tsx` — step 2 review: read balance, disable cook CTA if `totalBuzz > balance`, show "insufficient buzz · top up" link.
- Same for `PhotoshootWizard`.

**Acceptance:** user with insufficient balance sees a clear gate, not a 402 after the fact.

### 6. Asset detail "used in N campaigns" missing

**File:** `src/app/(app)/brand/assets/[id]/page.tsx` + `src/components/assets/AssetDetailView.tsx`

Design's lightbox shows "used in 4 campaigns". We omitted it. Either:
- query `campaigns` + tiles where `referenceAssetIds` contains this asset id (jsonb query); show count.
- skip; design fidelity isn't critical for MVP.

**Acceptance (if implementing):** add `usedInCount: number` to view props, render in kv-list.

---

## 🟡 Test gaps per plan

### 7. `src/lib/generations.test.ts` underseeded

Only `refreshGenerationSnapshot` covered (`src/lib/generations.refreshSnapshot.test.ts`). Plan asks:
- `recordGeneration` writes correct columns for each `source` value (`'campaign' | 'photoshoot' | 'upscale' | 'animate' | 'adhoc'`)
- `parentWorkflowId` + `parentImageIndex` round-trip for post-gen rows

**File to add:** `src/lib/generations.recordGeneration.test.ts`

### 8. Export route untested

**Files:**
- `src/app/api/campaigns/[id]/export/route.test.ts` (new)

Test: 401 unauth, 404 not found, 409 when no completed tiles, 200 + zip stream with expected entries when tiles done.

### 9. Campaigns/photoshoot regenerate route tests

`src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.test.ts` exists. Add photoshoot equivalent in step 1.

---

## 🟡 Dead code / hygiene (risk: stale paths still routable)

Delete in one cleanup pass. Verify nothing imports them first via `grep -rn '<name>' src/ e2e/`.

- `src/components/photoshoot/PhotoshootBuilder.tsx` — superseded by `PhotoshootWizard`.
- `src/components/campaigns/BriefForm.tsx` — superseded by inline form in `CampaignWizard`.
- `src/components/campaigns/SuggestionCard.tsx` — removed from `CampaignsList`, no callers.
- `src/components/assets/DeleteAssetButton.tsx` — superseded by inline delete in `AssetDetailView`.
- `src/components/GenerateForm.tsx` — legacy single-image generator, no UI mount.
- `src/lib/presets.ts` — `buildGenerateInput` export.
- `src/lib/photoshootTemplates.ts` — `buildPhotoshootInput` export.
- `src/lib/civitai.ts:227` — `type GenerateInput` re-export (only kept for orphans).
- `src/app/api/generate/route.ts` + `src/app/api/generate/estimate/route.ts` — legacy single-image routes.
- `src/app/api/campaigns/estimate/route.ts` — replaced by `/api/campaigns/preview`. Verify no callers, then delete.

Update `src/components/campaigns/index.ts`, `src/components/photoshoot/index.ts`, `src/components/assets/index.ts` barrel exports after deletion.

---

## 🟢 Lower priority / known unknowns

### 10. `videoGen` engine smoke test

`src/lib/civitai.ts:178` — `// TODO: confirm videoGen engine/model with smoke test`. Animate path works against MSW mock, real orchestrator engine unverified. Plan open question #6.

**Action:** run a smoke `estimateWorkflow` against dev orchestrator with each candidate engine (`wan`, `kling`, `runway`) and pick the cheapest stable one. Update `submitVideoAnimate`.

### 11. Nano Banana 2 field surface

Plan open question #5. `VitrineImageGenInput` shape (engine `google`, model `nano-banana-2`, prompt, images, aspectRatio, numImages, resolution) inferred. Run one estimate against dev to confirm; check whether `safetyLevel` / `personGeneration` are required.

### 12. Brand DNA suggestions on `/campaigns`

Removed from MVP. Design has 3 LLM-driven suggestion cards. Post-MVP: derive from brand DNA via a cheap completion, cache per-day.

### 13. R2 bucket policy for references

Plan open question #1. If MinIO/R2 bucket not public-read, `getPublicUrls` must mint long-TTL presigned GETs. Verify in dev: pick a non-public bucket, run a campaign cook with a reference asset, confirm orchestrator can fetch.

### 14. AdHoc generation save → R2 mirror

`src/app/api/assets/generate/save/route.ts` + `src/lib/assetMirror.ts` exist. Verify end-to-end: pick a generated image, save, confirm new `assets` row + the file lives in R2 (not just a URL pointer to orchestrator).

---

## Recommended attack order

1. **Item 1** (photoshoot regen) — biggest visible hole, ~30 lines of route + UI.
2. **Items 2, 3, 4** — composer/wizard polish, ~5 minutes each.
3. **Item 9** dead-code purge — fast, reduces cognitive load.
4. **Items 7, 8** — test gaps. Required before claiming "tested" status.
5. **Item 5** — buzz balance gate.
6. **Item 10, 11** — smoke tests against real orchestrator.
7. Everything else — post-MVP.

## What's solid (skip)

- Campaign wizard: brief → review → submit, fully wired.
- Composer → wizard prompt + ref threading (`/campaigns?prompt=&refs=`).
- Photoshoot wizard same shape.
- Asset detail page (lightbox-style, just shipped).
- Post-gen actions (upscale + animate) — routes + UI wired, awaiting real-engine smoke test.
- Ad-hoc generation modal (txt2img from `/brand/assets`).
- 305/305 unit tests pass, typecheck clean, build clean.
