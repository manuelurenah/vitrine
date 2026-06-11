# Design Gap Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Implementers:** This is a Next.js 16 App Router + TypeScript strict + React 19 + Tailwind 3.4 codebase. Each UI task names a **design source** under `design_handoff_vitrine/design_files/` — READ IT before building (it is the visual spec). Match existing component patterns in `src/components/ui/` (Button, Modal, Chip, Badge, BuzzPill, Input, Textarea, FieldLabel, IconButton, TabStrip). Use `lucide-react` for icons and the `cn()` helper. Tokens are CSS vars exposed as Tailwind utilities (e.g. `bg-bg-1`, `text-fg-0`, `border-line`, `t-eyebrow`, `t-h3`, volt colors). Never invent new color literals — use existing token utilities.

**Goal:** Close the desktop + mobile gaps catalogued in `claudedocs/design-handoff-gap-plan-2026-06-10.md` between the hi-fi design handoff and the shipped app.

**Architecture:** Mostly additive React component work plus two backend additions (a `tile_versions` table with a version-write hook, and a per-template photoshoot regenerate route). Schema work lands first because the single-creative-editor and version-history screens depend on it. Each task is independently shippable and verifiable.

**Tech Stack:** Next.js 16, Drizzle ORM (Postgres), Tailwind, lucide-react, Zod, Vitest (unit), Playwright (e2e).

---

## Conventions for every task

- **Branch:** already on `feature/design-gap-features`. Commit per task.
- **Verify gate (all tasks):** `pnpm typecheck` MUST pass. Tasks touching `next.config`/env/headers also run `pnpm build`. Logic tasks add `pnpm test:unit`. Schema tasks run `pnpm db:generate` and review the emitted SQL.
- **Lint/format:** run `pnpm format` before commit (Biome).
- **Voice rules (from design README):** UI copy is lowercase, terse. Buzz costs render inline on CTAs (e.g. `generate · 12 buzz`).
- **Out of scope (do NOT build — documented blockers):** native Buzz top-up modal + low/0-buzz states + notifications (pending designer mocks); catalog add-from-URL scrape + mode tabs (deferred to later version); Brand Book (not designed); campaigns suggestions grid, per-placement copy section, Brand DNA tabbed views, animate workspace (all descoped 2026-06-10).

---

## PHASE 0 — Foundations

### Task 1: `tile_versions` table + `lib/tileVersions.ts` + version-write hook

Backend foundation for §3.7 (version history) and §3.6 (editor shows version pill). A version row snapshots a campaign tile's editable state at each cook/regenerate.

**Files:**
- Modify: `src/lib/db/schema.ts` (add `tileVersions` table after `campaignTiles`, ~line 236)
- Create: `src/lib/tileVersions.ts`
- Create: `src/lib/tileVersions.test.ts`
- Modify: `src/lib/campaigns.ts` (call version-write inside `createCampaign` tile insert and `swapTileWorkflow`)
- Migration: emitted by `pnpm db:generate`

- [ ] **Step 1: Add schema table.** In `src/lib/db/schema.ts`, after `campaignTiles` (line 236), add:

```ts
export const tileVersions = pgTable(
  'tile_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tileId: uuid('tile_id')
      .references(() => campaignTiles.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    workflowId: text('workflow_id').notNull(),
    prompt: text('prompt').notNull(),
    adCopy: jsonb('ad_copy'),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    changeNote: text('change_note'),
    generationId: text('generation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tileIdx: index('tile_versions_tile_idx').on(t.tileId, t.version),
    tileVersionUidx: uniqueIndex('tile_versions_tile_version_uidx').on(t.tileId, t.version),
  }),
);
```

- [ ] **Step 2: Write failing test** `src/lib/tileVersions.test.ts` for the pure diff helper (no DB):

```ts
import { describe, expect, it } from 'vitest';
import { diffTileVersions, type TileVersionSnapshot } from './tileVersions';

const v = (over: Partial<TileVersionSnapshot>): TileVersionSnapshot => ({
  version: 1,
  prompt: 'a product on a table',
  adCopy: { headline: 'old head', subhead: 'old sub', cta: 'shop now' },
  ...over,
});

describe('diffTileVersions', () => {
  it('marks changed adCopy fields with old/new and unchanged otherwise', () => {
    const diff = diffTileVersions(v({ version: 1 }), v({ version: 2, adCopy: { headline: 'new head', subhead: 'old sub', cta: 'buy' } }));
    expect(diff.find((d) => d.field === 'headline')).toEqual({ field: 'headline', changed: true, old: 'old head', next: 'new head' });
    expect(diff.find((d) => d.field === 'subhead')).toEqual({ field: 'subhead', changed: false, old: 'old sub', next: 'old sub' });
    expect(diff.find((d) => d.field === 'cta')).toEqual({ field: 'cta', changed: true, old: 'shop now', next: 'buy' });
  });
  it('detects prompt change', () => {
    const diff = diffTileVersions(v({}), v({ version: 2, prompt: 'a product on marble' }));
    expect(diff.find((d) => d.field === 'prompt')?.changed).toBe(true);
  });
});
```

- [ ] **Step 3: Run test, expect FAIL.** Run: `pnpm test:unit src/lib/tileVersions.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/tileVersions.ts`.** Provide the snapshot type, the pure `diffTileVersions`, plus DB helpers `recordTileVersion(tx-or-db, input)`, `listTileVersions(userId, campaignId, tileId)`, and `nextVersionNumber(tileId)`. Follow the drizzle patterns in `src/lib/campaigns.ts` (ownership via join to `campaigns.userId`). `diffTileVersions(prev, next)` returns an array over fields `['headline','subhead','cta','prompt']` each `{ field, changed, old, next }`. `recordTileVersion` computes the next version number (`max(version)+1`, default 1) and inserts. `listTileVersions` joins `tile_versions → campaign_tiles → campaigns` filtered by `campaigns.userId` and orders by `version asc`.

- [ ] **Step 5: Run test, expect PASS.** Run: `pnpm test:unit src/lib/tileVersions.test.ts`.

- [ ] **Step 6: Wire the version-write hook.** In `src/lib/campaigns.ts`: inside `createCampaign`'s transaction, after inserting each tile, call `recordTileVersion(tx, { tileId, workflowId, prompt, adCopy, changeNote: 'cooked' })`. In `swapTileWorkflow`, after the workflow swap update, call `recordTileVersion(db, { tileId, workflowId: newWorkflowId, prompt: options?.prompt ?? existingPrompt, adCopy: options?.adCopy ?? existingAdCopy, changeNote: 'regenerated' })`. Keep version numbering monotonic.

- [ ] **Step 7: Generate migration.** Run: `pnpm db:generate`. Review emitted SQL in `drizzle/` — confirm one `CREATE TABLE tile_versions` + indexes, no destructive ops. Then `pnpm db:migrate` and `pnpm test:db:setup`.

- [ ] **Step 8: Typecheck + commit.** `pnpm typecheck` then commit `feat(tiles): tile_versions table, diff helper, version-write hook`.

---

### Task 2: Modal open/close animation + BottomSheet primitive

§0.3 + §16: `Modal` needs fade + scale 96%→100% on open; add a `BottomSheet` mobile primitive (slide-up) that `Modal` swaps to below a breakpoint.

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/BottomSheet.tsx`
- Modify: `src/app/globals.css` (keyframes if not expressible via Tailwind)

- [ ] **Step 1:** Add open/close transition to `Modal.tsx`. Introduce a `mounted` state so the dialog animates in: scrim `opacity` 0→1 and dialog `opacity`+`scale(0.96→1)` over ~160ms ease-out. Keep Esc + outside-click + body-scroll-lock behavior exactly as-is. Use Tailwind `transition`/`duration-150`/`ease-out` + a data-state attribute; add keyframes to `globals.css` only if a Tailwind utility can't express the scale+fade.
- [ ] **Step 2:** Create `BottomSheet.tsx`: fixed bottom sheet with a drag handle (visual only), blurred scrim, slide-up (`translateY(100%)→0`) animation, Esc + outside-click close, body-scroll-lock. Same prop shape as `Modal` (`open`, `onClose`, `title`, `eyebrow`, `children`, `footer`, `className`).
- [ ] **Step 3:** In `Modal.tsx`, render `BottomSheet` instead of the centered dialog when viewport `< 768px` (use a `useMediaQuery('(max-width: 767px)')` hook — create `src/components/ui/useMediaQuery.ts` if none exists; guard SSR by defaulting to desktop). Keep all existing Modal call sites working unchanged.
- [ ] **Step 4:** Verify: `pnpm typecheck`. Manually confirm no Modal consumer broke (grep `from './Modal'` / `from '@/components/ui/Modal'`). Commit `feat(ui): animated Modal + BottomSheet primitive`.

---

## PHASE 1 — Critical desktop features

### Task 3: Onboarding "what's next" modal + global keyboard nav

§2.5 + §2.6. Today `/onboarding/next` is a standalone route replacing the DNA screen. Design wants a modal overlaying the faded DNA screen with two large choice cards (campaigns recommended + photoshoot), inline previews + buzz cost + `start →`, and a footer alt link "or just drop me at the dashboard →". Also wire app-level ←/→ navigation between onboarding screens and Esc to close the modal.

**Design source:** `design_handoff_vitrine/design_files/onboarding-app.jsx` (the `next` screen + app-level key listener), `onboarding-icons.jsx`.

**Files:**
- Modify: `src/app/onboarding/[step]/page.tsx` (when `step === 'next'`, render DNA screen + overlay the modal)
- Modify/Create: `src/components/onboarding/NextStep.tsx` → render as modal content; create `NextChoiceModal.tsx` if cleaner
- Create previews: campaigns 3-post mini layout + photoshoot input-photo + 4-shot grid (inline SVG/divs, reference the jsx)
- Modify: `src/components/onboarding/OnboardingFrame.tsx` or add `src/components/onboarding/useOnboardingKeyboardNav.ts` for ←/→ between `ONBOARDING_STEPS`

- [ ] **Step 1:** Read `onboarding-app.jsx` `next` screen + the existing `NextStep.tsx`/`steps.ts`/`[step]/page.tsx`.
- [ ] **Step 2:** Render the `next` step as: the `dna` screen content dimmed behind a scrim, with a `Modal` (reuse Phase-0 animated Modal) containing the two choice cards. Card 1 (campaigns, "recommended" volt accent): 3-post mini preview, `60 buzz` BuzzPill, `start →` → `/campaigns`. Card 2 (photoshoot): input photo + 4-shot grid preview, `36 buzz`, `start →` → `/photoshoot`. Footer link "or just drop me at the dashboard →" → `/campaigns`. Closing the modal (Esc/outside) falls back to the dashboard route too. Keep `recordOnboardingStep(userKey,'next')` completing onboarding.
- [ ] **Step 3:** Add `useOnboardingKeyboardNav`: a client hook that listens for ArrowLeft/ArrowRight and routes to `prevStep`/`nextStep` (from `steps.ts`), ignoring when focus is in an input/textarea. Mount it in `OnboardingFrame`.
- [ ] **Step 4:** Verify `pnpm typecheck`; click through onboarding to confirm modal overlays DNA and arrows navigate. Commit `feat(onboarding): whats-next modal overlay + keyboard nav`.

---

### Task 4: Photoshoot per-template regenerate

§4.3. Per-tile regenerate exists; design wants a `regenerate template · 20 buzz` action on each template heading row that re-cooks all variants in that template group.

**Design source:** `hifi-photoshoot-screens.jsx` (results screen template heading rows).

**Files:**
- Create: `src/app/api/photoshoot/[id]/templates/[templateId]/regenerate/route.ts`
- Modify: `src/lib/photoshoots.ts` (add `regeneratePhotoshootTemplate` helper that swaps every tile's workflow in a template group)
- Modify: `src/app/api/photoshoot/cook/route.ts` — extract the per-template submit logic into a reusable function so the new route reuses it (DRY)
- Modify: `src/components/photoshoot/PhotoshootResults.tsx` (template heading row gets the regenerate link)

- [ ] **Step 1:** Read `src/app/api/photoshoot/cook/route.ts` + the existing per-tile regenerate route + `PhotoshootResults.tsx`.
- [ ] **Step 2:** Extract a `submitTemplateTiles(...)` helper (shared by cook + new route) that, for a given photoshoot + templateId + variant count, submits workflows via `submitImageGen`, records generation + buzz estimate per tile, and returns new workflow ids. Keep the audit-trail invariant (`recordGeneration` + `recordBuzzEvent`).
- [ ] **Step 3:** Implement POST `/api/photoshoot/[id]/templates/[templateId]/regenerate`: auth + ownership, swap each tile in the group to a fresh workflow (status→cooking), record generations/buzz, return updated tiles. Reuse `swapPhotoshootTileWorkflow` per tile.
- [ ] **Step 4:** In `PhotoshootResults.tsx`, add a `regenerate template · {cost} buzz` link to each template heading; on click POST the route, then refresh the group's tiles (re-mount the `CreativeCard`s with new workflow ids).
- [ ] **Step 5:** Verify `pnpm typecheck`. Commit `feat(photoshoot): per-template regenerate`.

---

### Task 5: Campaign single creative editor route

§3.6. Entirely missing. Route to view/edit one creative with field panels + action bar + "fix layout" promo.

**Design source:** `hifi-campaigns-screens-b.jsx` (single creative editor).

**Files:**
- Create: `src/app/(app)/campaigns/[id]/c/[creativeId]/page.tsx` (RSC: load campaign + tile + versions via `getCampaign` + `listTileVersions`)
- Create: `src/components/campaigns/CreativeEditor.tsx` (client)
- Create: `src/components/campaigns/PanelRow.tsx` (collapsible field panel)
- Create: `src/app/api/campaigns/[id]/tiles/[tileId]/route.ts` (PATCH: update `adCopy`/prompt fields without regenerating) — or extend existing regenerate route; PATCH is cleaner for field edits
- Modify: `src/lib/campaigns.ts` (add `updateTileFields(userId, campaignId, tileId, { adCopy?, prompt? })` that also writes a `tile_versions` row via Task 1 helper)

- [ ] **Step 1:** Read `hifi-campaigns-screens-b.jsx` editor screen + existing `CreativeCard.tsx`, `CampaignDetail.tsx`, regenerate route.
- [ ] **Step 2:** RSC page: load the tile; if not found/owned → `notFound()`. Pass tile + version list to `CreativeEditor`.
- [ ] **Step 3:** `CreativeEditor` left column: version pill (history icon + `version N of M` + ◀ ▶ chevrons navigating `tile_versions`), 4:5 canvas rendering the ad (eyebrow, headline, brand name, volt "shop now" pill over the generated image), action bar (`fix layout · 3 buzz`, regenerate, download, share, animate). Right column: collapsible `PanelRow`s for image / header / description / cta / logo / background. Header/description/cta edit `adCopy.{headline,subhead,cta}`; background edits the prompt; image/logo are read-only previews for v1. "Fix layout" and "regenerate" both POST the existing regenerate route (fix-layout passes a layout hint appended to prompt); field edits PATCH `updateTileFields`.
- [ ] **Step 4:** `updateTileFields` persists field changes and records a `tile_versions` row (`changeNote: 'edited'`). Add the "fix layout" promo card at the bottom of the left column (sparkles, cost, description).
- [ ] **Step 5:** Link into it: in `CreativeCard` (campaign context, done tiles) add a click-through to `/campaigns/[id]/c/[tileId]`.
- [ ] **Step 6:** Verify `pnpm typecheck`. Commit `feat(campaigns): single creative editor`.

---

### Task 6: Campaign version history route

§3.7. Depends on Task 1 + Task 5. Route showing all versions of a creative with a diff rail and restore/compare/delete actions.

**Design source:** `hifi-campaigns-screens-b.jsx` (version history screen).

**Files:**
- Create: `src/app/(app)/campaigns/[id]/c/[creativeId]/history/page.tsx` (RSC: `listTileVersions`)
- Create: `src/components/campaigns/VersionHistory.tsx` (client)
- Modify: `src/lib/tileVersions.ts` (add `restoreTileVersion(userId, campaignId, tileId, version)` → writes a new version cloning the chosen one with `changeNote: 'restored vN'`, and `deleteTileVersion(userId, campaignId, tileId, version)`)
- Create: `src/app/api/campaigns/[id]/tiles/[tileId]/versions/route.ts` (GET list) + `.../versions/[version]/route.ts` (POST restore, DELETE)

- [ ] **Step 1:** Read the history screen jsx.
- [ ] **Step 2:** RSC page loads versions; if <1 → render an empty state. Pass to `VersionHistory`.
- [ ] **Step 3:** `VersionHistory`: enhanced version pill, canvas with `vN · current` badge (volt + bloom border), a strip of all version thumbs (v-label + title + relative time), right rail "what changed in vN" computed with `diffTileVersions(prev,current)` (line-through old → new for changed `headline`/`cta`, "unchanged" for unchanged). Actions: `restore v{n-1}` (POST restore), `compare v{a} vs v{b}` (toggle two-up diff view), `delete this version` (DELETE; block deleting the only/current version with a confirm).
- [ ] **Step 4:** API routes implement list/restore/delete with ownership checks. `restoreTileVersion` also swaps the live tile back to the restored snapshot (prompt/adCopy/assetId) and writes the audit version row.
- [ ] **Step 5:** Add a `history` icon link in `CreativeEditor`'s version pill → `/campaigns/[id]/c/[tileId]/history`.
- [ ] **Step 6:** Verify `pnpm typecheck`. Commit `feat(campaigns): creative version history`.

---

## PHASE 2 — High polish

### Task 7: Filter pills on campaign Cooking/Ready

§3.4. Add filter pills (`all 8 · ig·feed 3 · ig·story 1 · reels 1 …`) above the creative grid that filter tiles by preset/channel.

**Design source:** `hifi-campaigns-screens-a.jsx` (cooking/ready screens).

**Files:**
- Modify: `src/components/campaigns/CampaignDetail.tsx`
- Create: `src/components/campaigns/FilterPills.tsx` (reusable count-chip strip)

- [ ] **Step 1:** Read cooking/ready screens + `CampaignDetail.tsx`.
- [ ] **Step 2:** Build `FilterPills` (client): props `{ options: {key,label,count}[], active, onChange }`, renders `Chip` with active check + count. Group campaign tiles by preset, build counts, add an `all {n}` option. Filtering hides non-matching `CreativeCard`s (keep them mounted to preserve polling? — unmount is fine since done tiles reload from snapshot cache; prefer CSS hide to keep polling alive).
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(campaigns): creative filter pills`.

---

### Task 8: Photoshoot results — 3-col header, source product card, filter chips, layout toggle, status copy

§4.3. Restructure results header to `280px 1fr 280px` grid with a left source-product card, center title, right action stack; add filter chips (`all · {total} | studio · 4 | in use · 4 | contextual · 4`) + right-aligned `by template | grid` layout toggle; add "X of Y ready · N still cooking" status line. Grid cap → 4 cols.

**Design source:** `hifi-photoshoot-screens.jsx` (results screen).

**Files:**
- Modify: `src/components/photoshoot/PhotoshootResults.tsx`
- Reuse: `FilterPills.tsx` (Task 7), `GradientThumb`

- [ ] **Step 1:** Read the results screen jsx + current `PhotoshootResults.tsx`.
- [ ] **Step 2:** Source product card: `bg-2` bordered card with product photo thumb + name + SKU + `// templates · {n}` eyebrow + active template chips. Center: title + status line. Right: action stack (share/download/more). Filter chips filter tiles by template/group; layout toggle switches between per-template grouping (current) and a flat grid. Bump grid to `xl:grid-cols-4`.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(photoshoot): results header + filters + layout toggle`.

---

### Task 9: Brief modal look — submitted-prompt sidecar + goal dropdown

§3.3. On `/campaigns/new` brief step, add the submitted-prompt sidecar box (eyebrow + styled box showing the originating prompt) and convert the Goal text input to a dropdown (`promote a new product ▼` etc.). Keep the dedicated route (modal *look*, not overlay).

**Design source:** `hifi-campaigns-screens-a.jsx` (brief modal).

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx` (brief step)
- Create: `src/components/ui/Select.tsx` if no select atom exists (styled native `<select>` matching Input)

- [ ] **Step 1:** Read brief screen jsx + `CampaignWizard.tsx` brief step.
- [ ] **Step 2:** Add sidecar box showing the prompt that triggered the brief (from the `?prompt=` param / state). Add a `Select` atom and use it for Goal with options like `promote a new product`, `drive signups`, `announce a launch`, `seasonal sale`, `build awareness` (lowercase). Persist `goal` as before.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(campaigns): brief sidecar + goal dropdown`.

---

### Task 10: Add-product multi-photo grid + save-as-draft

§5.3. Replace single-photo upload with a multi-photo grid (2×2 cover + 4 singles, up to 8) and add a "save as draft" secondary action. URL scrape + mode tabs stay out of scope.

**Design source:** `catalog-screens.jsx` (add product), `catalog-assets-app.jsx`.

**Files:**
- Modify: `src/components/catalog/AddProductForm.tsx`
- Reuse: existing presign/finalize flow + `createProduct` (`imageAssetIds` already supports up to 8, first = hero)

- [ ] **Step 1:** Read add-product jsx + `AddProductForm.tsx`.
- [ ] **Step 2:** Render a photo grid: first slot is a larger 2×2 cover, remaining up to 7 singles; each supports upload (presign→PUT→finalize) and remove; reorder so the first is hero. "save as draft" submits with `status: 'draft'`; primary submits with `status: 'live'`. Respect the 8-photo cap (`mergeImageAssetIds`).
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(catalog): multi-photo add-product + save draft`.

---

### Task 11: Catalog empty state polish

§5.2. Add the `Layers` icon glyph in a volt-soft box + keep routing straight to the scratch form (two-choice card deferred with URL scrape) + add fallback link "or skip for now — upload to assets instead →".

**Design source:** `catalog-screens.jsx` (empty state).

**Files:**
- Modify: `src/components/catalog/CatalogGrid.tsx` (empty branch)

- [ ] **Step 1:** Read the empty-state jsx + current empty branch.
- [ ] **Step 2:** Replace the text-only empty card with: volt-soft rounded box containing `Layers` icon, the existing copy, primary `new product` → `/brand/catalog/new`, and a muted fallback link → `/brand/assets/new`. Do NOT add the URL/scratch two-choice cards (deferred).
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(catalog): empty-state glyph + fallback link`.

---

### Task 12: Assets empty state polish

§6.2. Icon glyph + bloom in volt-soft box, gradient headline w/ highlighted keyword, big dropzone, "or pick a collection" divider + 4 collection cards (logos / partners / past campaigns / references), fallback link to catalog.

**Design source:** `assets-screens.jsx` (empty state).

**Files:**
- Modify: `src/components/assets/AssetsGallery.tsx` (the `EmptyState` it renders) — locate the `EmptyState` component (inline or separate file) and expand it.

- [ ] **Step 1:** Read the empty-state jsx + the current `EmptyState` used by `AssetsGallery`.
- [ ] **Step 2:** Build: volt-soft icon box + bloom, gradient headline with a highlighted keyword, a large dropzone area (clicking → `/brand/assets/new`; real drag-drop optional), a divider "or pick a collection", 4 collection cards each linking to `/brand/assets/new?collection=<name>`, and a fallback link to `/brand/catalog`. Keep the existing `generate` action.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(assets): rich empty state`.

---

### Task 13: Brand DNA chip groups + previews + progress bar

§7.1. Tabs stay descoped (flat form). Add: identity card (logo wordmark + URL), logo render preview, font family `Aa` preview, palette swatch previews with hex labels, editable chip groups for values/aesthetic/voice (replace text inputs), and a `100% complete` progress bar at the bottom.

**Design source:** `vitrine-shell.jsx` / onboarding `DnaStep.tsx` (reuse its `TagInput`, `LogoPreview`, `FontPicker`, color swatch patterns).

**Files:**
- Modify: `src/components/brand/BrandEditor.tsx`
- Reuse: `TagInput`, `LogoPreview`, `FontPicker`, `ColorPickerChip` from `src/components/onboarding/`

- [ ] **Step 1:** Read `BrandEditor.tsx` + the onboarding `DnaStep.tsx` for the chip-group/preview patterns.
- [ ] **Step 2:** Add an identity card (logo wordmark preview + source URL). Add font `Aa` preview next to the font field. Render palette as swatch previews with inline hex labels. Convert tone/values/aesthetic to `TagInput` chip groups (persist as comma-joined string in `tone` and as new fields if needed — keep persistence backward compatible: store voice/values/aesthetic inside existing fields or `description`/`tone`; do NOT add DB columns unless required, prefer reusing `tone`). Add a completion progress bar computed from filled fields. Keep `PATCH /api/brand/[id]` working.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(brand): dna chip groups, previews, progress`.

---

### Task 14: Photoshoot builder — recommended group + sticky-bar buzz cost + estimate copy + ratio chips + product radio list

§4.2. Add a "recommended for [product]" template group (first group, "based on brand dna" badge), product radio list in left column (SKU + selected styling), sticky bar with estimate copy ("3 templates × 4 variants") + inline `generate · 60 buzz` on the CTA + `|` dividers, and reduce ratio chips to 3 (4:5, 9:16, 1:1).

**Design source:** `hifi-photoshoot-screens.jsx` (builder screen).

**Files:**
- Modify: `src/components/photoshoot/PhotoshootWizard.tsx`
- Modify: `src/lib/photoshootTemplates.ts` (add a derived "recommended" grouping — do not change template ids; add a helper that returns recommended template ids given a product/brand)

- [ ] **Step 1:** Read builder jsx + `PhotoshootWizard.tsx` + `photoshootTemplates.ts`.
- [ ] **Step 2:** Left column: product radio rows (SKU + volt-soft selected bg + check) sourced from the user's products (pass product list into the wizard via the page RSC). Templates: prepend a "recommended for {productName}" group with a "based on brand dna" badge (recommended set = a sensible subset, e.g. one per group). Ratio chips → `['4:5','9:16','1:1']`. Sticky bottom bar: `{n} templates × {v} variants` estimate copy, `|` dividers, total shots, and CTA `generate · {cost} buzz`.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(photoshoot): builder recommended group + sticky cost bar`.

---

### Task 15: Inline buzz cost on CTAs + PromptComposer mic

§0.3 + §3.13 + §1 voice rule. PromptComposer: add a mic button (`Mic` icon, non-functional affordance is fine — wire to no-op or basic Web Speech if trivial) and change CTA from `generate brief` to `generate · {cost} buzz`. Ensure photoshoot generate CTA shows inline buzz (covered partly by Task 14 — here ensure consistency across both composer entry points).

**Design source:** PromptComposer in `hifi-campaigns-screens-a.jsx`.

**Files:**
- Modify: `src/components/campaigns/PromptComposer.tsx`

- [ ] **Step 1:** Read the composer design + current `PromptComposer.tsx`. Determine the per-brief estimate (use the existing estimate logic / a static per-preset estimate if no estimate call is wired here — match what `CampaignWizard` shows).
- [ ] **Step 2:** Add a `Mic` `IconButton` in the composer toolbar. Change the CTA label to `generate · {cost} buzz`. Keep routing to `/campaigns/new`.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(campaigns): composer mic + inline buzz cost`.

---

### Task 16: Login copy fix

§1. Headline → `one door. all your buzz.` (volt gradient on the second line). Replace the 4 feature bullets with 3 checked "travels with you" rows. Make the email disclosure an inline visual disclosure. Move the responsive breakpoint to 960px.

**Design source:** `design_files/Login.html`.

**Files:**
- Modify: `src/components/login/*` (the pitch column + headline + disclosure), `src/app/page.tsx` if copy lives there

- [ ] **Step 1:** Read `Login.html` + the current login components.
- [ ] **Step 2:** Update headline (two lines, volt gradient on line 2), swap to 3 checked rows, make the email disclosure inline (expand in place), and change the `lg:` breakpoint usage to a `min-[960px]:` arbitrary breakpoint to match 960px.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(login): match handoff copy + 960px breakpoint`.

---

## PHASE 3 — Medium interaction/state

### Task 17: CreativeCard hover-reveal + cooking overlay audit

§3.5 + §0.3. Animate/download actions become a hover-reveal overlay (not always-visible footer). Audit the cooking overlay to match design's still-sparkle 36px volt-soft circle (not animated).

**Files:**
- Modify: `src/components/campaigns/CreativeCard.tsx`

- [ ] **Step 1:** Read `CreativeCard.tsx` + the done/cooking states in `hifi-campaigns-screens-a.jsx`.
- [ ] **Step 2:** Move animate/download into an overlay revealed on `group-hover`; keep keyboard focus accessibility (reveal on focus-within too). Replace any animated cooking spinner with a still sparkle in a 36px volt-soft circle. Don't break photoshoot-context tile menu logic.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(campaigns): hover-reveal actions + cooking overlay`.

---

### Task 18: Photoshoot list — grid cap, square thumbs, hero CTA card

§4.1. Cap grid at 3 cols, uniform 1:1 2×2 collage thumbs, hero CTA card with icon bloom + gradient backdrop, add date to card meta.

**Files:**
- Modify: `src/components/photoshoot/PhotoshootList.tsx`

- [ ] **Step 1:** Read the list jsx + `PhotoshootList.tsx`.
- [ ] **Step 2:** Cap grid `lg:grid-cols-3` (drop `xl:grid-cols-5`). Make thumbs a uniform 1:1 2×2 collage. Wrap the hero CTA (Link+Button) in a unified card with icon bloom glow + gradient backdrop. Add created-date to meta (`{ratio} · {n} shots · {date}`).
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(photoshoot): list grid cap + hero card`.

---

### Task 19: Catalog detail polish

§5.4. 4:3 hero, photo edit(wand)/delete controls + position indicator (`X / Y · cover`), add-photo/upload buttons in strip, "used in campaigns" grid, "start photoshoot" CTA, more (•••) menu.

**Design source:** `catalog-screens.jsx` (detail).

**Files:**
- Modify: `src/components/catalog/ProductDetail.tsx`
- Maybe: `src/app/api/catalog/products/[id]/route.ts` (already supports PATCH image set) + `appendProductImages`

- [ ] **Step 1:** Read detail jsx + `ProductDetail.tsx`.
- [ ] **Step 2:** Hero aspect → 4:3; overlay position indicator + wand/delete controls; strip gains add-photo/upload (reuse presign/finalize + `appendProductImages`); add a "used in campaigns" grid (query campaigns referencing this product — if no helper, add `listCampaignsUsingProduct(userId, productId)` to `lib/campaigns.ts`); add a "start photoshoot" CTA (`buildPhotoshootNewHref`); add a more (•••) menu.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(catalog): product detail polish`.

---

### Task 20: Catalog grid — sort + grid/list toggle + photo-count + per-card menu

§5.1. Sort dropdown (`recent ▼`), grid/list segmented toggle, photo-count badge overlay, per-card more (•••) menu. Align filter set with design (`draft` instead of `archived` — keep both if data uses archived; design shows draft).

**Files:**
- Modify: `src/components/catalog/CatalogGrid.tsx`
- Reuse: `Select` (Task 9)

- [ ] **Step 1:** Read catalog grid jsx + `CatalogGrid.tsx`.
- [ ] **Step 2:** Add a sort `Select` (recent / name / status), a grid/list segmented toggle (TabStrip-like), photo-count badge on cards (count from product images), per-card more menu (edit/delete). Add a `draft` filter chip alongside live/archived.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(catalog): sort, list view, card menu`.

---

### Task 21: Assets gallery — toolbar filter chips, grid/list, view-all, tile variants, StagedFile uploader

§6.1 + §6.3. Toolbar filter chips with counts, grid/list toggle, per-section "view all →", logo/partner tile styling variants. Uploader: StagedFile layout (thumb-sm + name + format/size + per-file progress) + "X of Y uploaded" footer.

**Design source:** `assets-screens.jsx`.

**Files:**
- Modify: `src/components/assets/AssetsGallery.tsx`, `src/components/assets/AssetUploader.tsx`
- Reuse: `FilterPills` (Task 7)

- [ ] **Step 1:** Read assets jsx + both components.
- [ ] **Step 2:** Gallery: toolbar `FilterPills` (all/logos/partners/past campaigns/references with counts), grid/list toggle, "view all →" per section, logo tile gradient/outline/volt-mark variants, partner tile centered-name overlay. Uploader: StagedFile row layout + "X of Y uploaded" footer string.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(assets): gallery toolbar + tile variants + staged uploader`.

---

### Task 22: Light theme toggle UI

§0.4. Token plumbing + `[data-theme="light"]` exist; add the toggle UI in TopBar/UserMenu and persist preference.

**Files:**
- Modify: `src/components/shell/TopBar.tsx` (or UserMenu)
- Create: `src/components/shell/ThemeToggle.tsx` + a small client hook that sets `data-theme` on `<html>` and persists to `localStorage`

- [ ] **Step 1:** Read TopBar + how `data-theme` is applied (check `globals.css` + any root layout).
- [ ] **Step 2:** Add a `ThemeToggle` (sun/moon `lucide-react`) that toggles `document.documentElement.dataset.theme` between dark/light, persists to localStorage, and reads it on mount (guard SSR flash with an inline script in root layout if needed).
- [ ] **Step 3:** Verify `pnpm typecheck` + `pnpm build`. Commit `feat(shell): light theme toggle`.

---

## PHASE 4 — Low copy/visual drift (onboarding)

### Task 23: Onboarding welcome + cross-screen copy/eyebrow/progress consistency + pencil indicators + decorative SVGs

§2.1–2.4. Welcome: decorative SVGs in step cards (DNA wave, campaign tile grid, photoshoot composition), step copy → "build your brand DNA / cook three reads / shoot, post, ship", progress dots (not pills). Input: show "recommended" badge consistently, lowercase eyebrow. Generating: exact task labels + cycle timing ~850ms, verify animations, step-numbered eyebrow. DNA: pencil edit indicators on card heads, eyebrow `// dna reveal`, static 100% progress.

**Design source:** `Onboarding.html`, `onboarding-app.jsx`, `onboarding-icons.jsx`, `onboarding.css`.

**Files:**
- Modify: `src/components/onboarding/WelcomeStep.tsx`, `InputStep.tsx`, `ProcessingStep.tsx`, `DnaStep.tsx`, `OnboardingFrame.tsx`

- [ ] **Step 1:** Read the four design sources for exact copy/SVGs/eyebrows/timings.
- [ ] **Step 2:** Welcome: add the three decorative SVGs, fix step-card copy, switch progress indicator to circular dots in `OnboardingFrame`. Input: always-show "recommended" badge, lowercase eyebrow. Generating: exact task labels (`reading your site` → `extracting palette` → `tasting your tone of voice` → `sketching your audience` → `naming the read`) cycling ~850ms; verify pulse-ring/dna-rotate/shimmer/scan animations exist (add via `globals.css` keyframes if missing); step-numbered eyebrow. DNA: pencil icons on card heads, eyebrow `// dna reveal`, static 100% progress.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(onboarding): copy, eyebrows, progress dots, decorative svgs`.

---

## PHASE 5 — Mobile shell + responsive (§0.5, §8)

> Decision (§8): responsive single tree — no `/m/*` routes. Mobile components render conditionally below a breakpoint inside `(app)/layout.tsx`. This phase is large; ship the shell first (unblocks everything), then convert screens.

### Task 24: Mobile shell components

§0.5. Build the mobile shell primitives.

**Design source:** `mobile-shell.jsx`, `mobile-app.jsx`.

**Files (create under `src/components/shell/`):**
- `MobileTopBar.tsx` (52px sticky, `rgba(15,15,22,0.92)` + `blur(14px)`)
- `MobileTabBar.tsx` (76px bottom, 4 tabs campaigns·shoot·animate·brand, volt-active + home indicator)
- `ScreenFrame.tsx` (topbar + scroll content + tab bar + optional bloom + optional sticky CTA slot)
- `FAB.tsx` (52px volt fill + label, volt bloom, bottom 92px/right 16px, `Plus` icon)
- `BrandSubTabs.tsx` (inner sub-tab strip: DNA · Catalog · Assets · Book)
- Reuse `BottomSheet` from Task 2.

- [ ] **Step 1:** Read `mobile-shell.jsx` for exact dimensions/styles.
- [ ] **Step 2:** Build each primitive matching the jsx. Touch targets ≥44px (§8 prereq 2). Use `lucide-react` icons.
- [ ] **Step 3:** Verify `pnpm typecheck`. Commit `feat(shell): mobile shell primitives`.

---

### Task 25: Wire responsive shell into app layout

§8 prereqs 1–3. Render mobile shell below the breakpoint inside `(app)/layout.tsx`; ensure `Modal` already swaps to `BottomSheet` (Task 2). Brand sub-tabs render inside the brand routes on mobile.

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify brand routes to mount `BrandSubTabs` on mobile.

- [ ] **Step 1:** Read `(app)/layout.tsx` + `Shell.tsx`.
- [ ] **Step 2:** Below `768px`, render `ScreenFrame` (MobileTopBar + content + MobileTabBar) instead of the desktop `Shell` grid; above, keep desktop. Active tab derives from the route. Mount `BrandSubTabs` in the brand section on mobile.
- [ ] **Step 3:** Verify `pnpm typecheck` + `pnpm build`. Commit `feat(shell): responsive mobile/desktop switch`.

---

### Task 26: Responsive screen passes (campaigns, photoshoot, catalog, assets, onboarding, login)

§3.8/§4.4/§5/§6/§2.7/§1 mobile. Apply the mobile artboard compositions as responsive layouts within existing route files. Sticky CTA above tab bar for the photoshoot builder (`generate · 60 buzz`) and campaign brief sheet via `BottomSheet`.

**Design source:** `mobile-campaigns.jsx`, `mobile-photoshoot.jsx`, `mobile-catalog.jsx`, `mobile-auth.jsx`.

This is delivered as sub-commits per surface (each verified with `pnpm typecheck`):
- [ ] **26a Campaigns mobile:** list, brief sheet (BottomSheet), cooking, ready, editor, history responsive.
- [ ] **26b Photoshoot mobile:** list, builder (sticky CTA), results responsive.
- [ ] **26c Catalog mobile:** catalog grid + detail responsive.
- [ ] **26d Assets mobile:** gallery + uploader responsive.
- [ ] **26e Onboarding + login mobile:** 5 onboarding screens + login (status badge "buzz · live" volt dot, stacked pitch + auth card, footer metadata).

Commit each sub-step `feat(mobile): <surface> responsive`.

---

## Final review

After all tasks: dispatch a final code review over the full branch diff, run `pnpm typecheck` + `pnpm build` + `pnpm test:unit`, then use superpowers:finishing-a-development-branch.

## Self-review notes (coverage map)

- §0.3 → T2 (Modal anim, BottomSheet), T15 (mic), T17 (cooking overlay). §0.4 → T22. §0.5 → T24/T25.
- §1 → T16 (desktop), T26e (mobile). §2.5/2.6 → T3. §2.1–2.4 → T23. §2.7 → T26e.
- §3.3 → T9. §3.4 → T7. §3.5 → T17. §3.6 → T5. §3.7 → T6 (+T1). §3.8 → T26a.
- §4.1 → T18. §4.2 → T14. §4.3 → T4 (regenerate) + T8 (header/filters). §4.4 → T26b.
- §5.1 → T20. §5.2 → T11. §5.3 → T10. §5.4 → T19. §6.1 → T21. §6.2 → T12. §6.3 → T21.
- §7.1 → T13. §16 → T2. §8/mobile → T24/T25/T26.
- Documented out-of-scope: §7.4 top-up/low-buzz/notifications (mocks), §5.2/5.3 URL scrape (deferred), §7.2 Brand Book (undesigned), descoped items.
