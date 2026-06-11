# E2E Tests for Design-Gap Features — Spec & Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One spec file per task; each task = add the data-testids it needs + (optional) db helper + the spec. Steps use `- [ ]`.

**Goal:** Add Playwright e2e coverage for the new features shipped on the design-gap branch (now on `main`): single creative editor, creative version history, photoshoot per-template regenerate, onboarding "what's next" modal, and the mobile shell.

**Architecture:** The harness already authenticates via an injected `civ_session` cookie (`signInToApp`), isolates the DB per test (`resetUserData` + `markOnboardingComplete`), and mocks the Civitai orchestrator via MSW (deterministic `pending → processing → succeeded` over 3 polls, images on poll 3, 60 buzz/image). New specs follow the existing `50-campaigns` / `60-photoshoot` recipe: **seed → navigate → act → assert (UI + DB)**. Where a flow needs a finished campaign, we add a `seedDoneCampaign` db helper rather than cooking from scratch (faster, deterministic). The feature components currently expose **no `data-testid`s**, so each task first adds the minimal stable testids it selects on.

**Tech stack:** Playwright (`e2e/*.spec.ts`, `workers: 1`, sequential), `pg.Pool` db helpers (`e2e/helpers/db.ts`), MSW (`src/mocks/handlers.ts`).

---

## Harness facts (from the existing suite — don't re-derive)

- **Run:** `pnpm test:e2e` (needs `CIVITAI_BASE_URL` to a Civitai dev host with `testing-login`, the `vitrine_test` DB via `pnpm test:db:setup`, OAuth app redirect URIs incl. `http://localhost:3334/...`). Server boots via `pnpm test:server` with `MOCK_CIVITAI=1`.
- **Auth:** `import { signInToApp } from './helpers/auth'` → `await signInToApp(page, baseURL!)`. Lands in `/campaigns` (or `/onboarding/<step>` if onboarding incomplete).
- **DB isolation:** `import { resetUserData, markOnboardingComplete, seedProduct, seedAsset, seedDonePhotoshoot, countRows, testUserId } from './helpers/db'`. Call `resetUserData()` + `markOnboardingComplete()` in `beforeEach`/`beforeAll`.
- **MSW orchestrator:** submit returns `processing`; poll 1 `pending`, 2 `processing`, 3+ `succeeded` with images `https://image.mock/{wf}/{i}.png`. Tests wait for `page.locator('img').first()` with a 30s timeout.
- **Selectors:** prefer `getByTestId`. New testids must be **stable + lowercase-kebab**, suffixed with ids where dynamic (e.g. `tile-card-${tileId}`).
- **DB asserts:** `countRows(table)` filters by `user_id` — works for `generations`, `buzz_events`, `campaigns`, `campaign_tiles`, `photoshoot_tiles`. **Does NOT work for `tile_versions`** (no `user_id` column). Add dedicated helpers (Task 0).
- **Fixtures:** `import { expect, test } from './fixtures'`.

---

## Task 0: DB helpers for campaigns + tile_versions

New specs for the editor/history need a finished campaign with a tile and version rows, plus version-count assertions. Add to `e2e/helpers/db.ts`.

**Files:** Modify `e2e/helpers/db.ts`.

- [ ] **Step 1:** Add `seedDoneCampaign(input?, userId = testUserId)`:
  - `input?: { title?: string; presetId?: string; adCopy?: { headline: string; subhead: string; cta?: string }; prompt?: string; versions?: number }`.
  - Ensure the `users` row exists (mirror `markOnboardingComplete`'s upsert). Insert a `campaigns` row (`title`, `brief` jsonb `{}`, `preset_ids` `[presetId]`, `estimated_buzz`). Insert ONE `campaign_tiles` row: `preset_id` (default `'ig-feed'`), a unique `workflow_id` (e.g. `mock-seed-<rand>`), `prompt` (default `'a product on a table'`), `status='done'`, `ad_copy` jsonb (default `{ headline:'old head', subhead:'old sub', cta:'shop now' }`), linked `asset_id` (create a `generated` asset via the same insert path `seedDonePhotoshoot` uses). Then insert `input.versions ?? 1` `tile_versions` rows for that tile with monotonically increasing `version` (1..N), `workflow_id`, `prompt`, `ad_copy` (vary the headline per version so diffs are non-trivial, e.g. `head v{n}`), `change_note` (`'cooked'` for v1, `'regenerated'` for the rest). Return `{ id, tileId, assetId, versionCount }`.
- [ ] **Step 2:** Add `countTileVersions(tileId: string): Promise<number>` → `SELECT count(*)::int FROM tile_versions WHERE tile_id = $1`.
- [ ] **Step 3:** Add `getTile(tileId: string): Promise<{ status: string; prompt: string; adCopy: unknown }>` → `SELECT status, prompt, ad_copy FROM campaign_tiles WHERE id = $1` (for asserting restore/edit effects).
- [ ] **Step 4:** Ensure `resetUserData` already truncates `campaign_tiles` + `tile_versions` (cascade from `campaigns`). If `tile_versions` isn't covered by the cascade truncate list, confirm the FK cascade handles it (it's `ON DELETE CASCADE` from `campaign_tiles`); no change needed if campaigns truncate cascades. Verify by reading `resetUserData`.
- [ ] **Step 5:** `pnpm typecheck` (helpers are TS). Commit `test(e2e): seedDoneCampaign + tile_versions db helpers`.

---

## Task 1: Add `data-testid`s to the feature components

Add minimal, stable testids the specs select on. No behavior changes — testids only. One commit.

**Files (modify):**
- `src/components/campaigns/CreativeEditor.tsx`
- `src/components/campaigns/PanelRow.tsx`
- `src/components/campaigns/VersionHistory.tsx`
- `src/components/photoshoot/PhotoshootResults.tsx`
- `src/components/onboarding/NextChoiceModal.tsx` (+ `NextScreen.tsx` for the dimmed DNA wrapper)
- `src/components/shell/MobileTabBar.tsx`, `ScreenFrame.tsx`, `FAB.tsx`
- `src/components/ui/BottomSheet.tsx`

- [ ] **CreativeEditor:** `creative-editor`, the version pill `editor-version-pill` (+ `editor-version-label` text like `version 2 of 3`), chevrons `editor-version-prev` / `editor-version-next`, history link `editor-history-link`, action bar buttons `editor-fix-layout` / `editor-regenerate` / `editor-download` / `editor-share` / `editor-animate`, and on each editable `PanelRow` the field inputs `editor-field-header` / `editor-field-description` / `editor-field-cta` / `editor-field-background` + the save button `editor-save`.
- [ ] **PanelRow:** add an optional `testId?: string` prop applied to the header button (so the editor can pass `panel-header-${field}`); keep existing behavior.
- [ ] **VersionHistory:** `version-history`, the thumb strip items `version-thumb-${version}`, the current badge `version-current-badge`, diff rail `version-diff`, the restore button `version-restore`, compare toggle `version-compare`, delete button `version-delete`, and the error/alert region `version-error`.
- [ ] **PhotoshootResults:** the per-template regenerate button `regenerate-template-${templateId}`, each tile `pshoot-tile-${tileId}`, the filter pills container `pshoot-filters`, layout toggle buttons `pshoot-layout-template` / `pshoot-layout-grid`, the source product card `pshoot-source-product`.
- [ ] **Onboarding next:** `next-choice-modal`, the two cards `next-choice-campaigns` / `next-choice-photoshoot` with their `start →` actions `next-start-campaigns` / `next-start-photoshoot`, the dashboard fallback `next-dashboard-link`, and on the dimmed DNA wrapper in `NextScreen` `next-dna-behind`.
- [ ] **Mobile shell:** `MobileTabBar` → container `mobile-tab-bar` + each tab `mobile-tab-${key}` (campaigns/shoot/animate/brand); `ScreenFrame` → `screen-frame` + `screen-sticky-cta` on the sticky slot; `FAB` → `fab`; `BottomSheet` → `bottom-sheet`.
- [ ] **Verify:** `pnpm typecheck` + `pnpm build`. Commit `test(e2e): add data-testids to new feature components`.

---

## Task 2: `e2e/52-creative-editor.spec.ts`

Covers §3.6. Seed a done campaign, open the editor, edit a field (PATCH → version row), regenerate, fix-layout.

**Files:** Create `e2e/52-creative-editor.spec.ts`.

- [ ] **beforeEach:** `resetUserData()` + `markOnboardingComplete()`.
- [ ] **Test A — renders editor for a done tile:** seed `seedDoneCampaign({ versions: 1 })`; `signInToApp`; `goto /campaigns/{id}/c/{tileId}`; assert `creative-editor` visible, `editor-version-label` reads `version 1 of 1`, the canvas `img` visible, the action bar buttons present.
- [ ] **Test B — field edit persists + writes a version:** from the editor, record `countTileVersions(tileId)` (=1). Fill `editor-field-header` with `e2e new headline`, click `editor-save`; wait for the save to settle (button re-enabled / a success state / `page.waitForResponse` on `PATCH .../tiles/{tileId}`). Assert `countTileVersions(tileId) === 2` and `getTile(tileId).adCopy.headline === 'e2e new headline'`.
- [ ] **Test C — regenerate re-cooks the tile:** record `countRows('generations')`; click `editor-regenerate`; assert a new generation recorded (`countRows('generations')` increased by 1) and the tile returns to a cooking state then an image re-renders (wait `img` visible, 30s).
- [ ] **Test D — fix-layout sends a prompt hint:** click `editor-fix-layout`; `page.waitForRequest`/`waitForResponse` on `POST .../tiles/{tileId}/regenerate` and assert the request body contains `promptHint` (use `request.postDataJSON()`), distinguishing it from plain regenerate. Assert a generation was recorded.
- [ ] **Verify:** run `pnpm test:e2e --grep "creative editor"` (document if the Civitai dev server isn't reachable in the run env — the spec is still committed). Commit `test(e2e): creative editor edit/regenerate/fix-layout`.

---

## Task 3: `e2e/53-version-history.spec.ts`

Covers §3.7 incl. the restore/delete + 409-refusal logic.

**Files:** Create `e2e/53-version-history.spec.ts`.

- [ ] **beforeEach:** reset + onboarding complete.
- [ ] **Test A — renders all versions + diff:** seed `seedDoneCampaign({ versions: 3 })`; `goto /campaigns/{id}/c/{tileId}/history`; assert `version-history` visible, three `version-thumb-*`, `version-current-badge` on the latest, and `version-diff` shows a changed field (headline differs across versions).
- [ ] **Test B — restore writes a new version + reverts the tile:** record `countTileVersions` (=3). Select an older version thumb (`version-thumb-2`), click `version-restore`; wait for `waitForResponse` `POST .../versions/2`. Assert `countTileVersions === 4` and `getTile(tileId).adCopy.headline` equals v2's headline (`head v2`).
- [ ] **Test C — delete a non-current version succeeds:** seed `versions: 3`; select `version-thumb-1`, click `version-delete`, confirm (the component uses `window.confirm` — `page.on('dialog', d => d.accept())`); `waitForResponse` `DELETE .../versions/1` → 200; assert `countTileVersions === 2`.
- [ ] **Test D — delete current version is refused (409):** seed `versions: 2`; select the current (`version-thumb-2`), click `version-delete`, accept the confirm; assert the `DELETE .../versions/2` response status is 409 AND `version-error` shows the refusal copy (`can't delete the current version` or similar), and `countTileVersions` is unchanged (=2).
- [ ] **Verify + commit** `test(e2e): version history restore/delete/refusal`.

---

## Task 4: `e2e/61-photoshoot-regenerate.spec.ts`

Covers §4.3 per-template regenerate (data-mutating).

**Files:** Create `e2e/61-photoshoot-regenerate.spec.ts`.

- [ ] **beforeEach:** reset + onboarding complete.
- [ ] **Test A — per-template regenerate re-cooks the group + records audit:** seed `seedDonePhotoshoot({ tileCount: 2, templateId: 'studio-clean' })`; `signInToApp`; `goto /photoshoot/{id}`; assert the results render with two `pshoot-tile-*` and the `regenerate-template-studio-clean` button visible. Record `countRows('generations')` and `countRows('buzz_events')`. Click `regenerate-template-studio-clean`; `waitForResponse` `POST .../templates/studio-clean/regenerate` → 200. Assert: both tiles in the group return to a cooking state (then images re-render, `img` visible 30s), `countRows('generations')` increased by 2, `countRows('buzz_events')` increased by ≥2 (estimate per tile). 
- [ ] **Test B — filter + layout toggle:** assert `pshoot-filters` chips present; click `pshoot-layout-grid` then `pshoot-layout-template` and assert the tile grid stays populated (no tiles lost on toggle).
- [ ] **Verify + commit** `test(e2e): photoshoot per-template regenerate`.

---

## Task 5: `e2e/11-onboarding-next.spec.ts`

Covers §2.5/§2.6 — the "what's next" modal overlay + keyboard nav. This runs WITHOUT `markOnboardingComplete` (we want the onboarding flow).

**Files:** Create `e2e/11-onboarding-next.spec.ts`.

- [ ] **beforeEach:** `resetUserData()` only (do NOT mark onboarding complete).
- [ ] **Test A — next step renders as a modal over the DNA screen:** `signInToApp` (lands on `/onboarding/<step>`); `goto /onboarding/next`; assert `next-choice-modal` visible AND `next-dna-behind` present in the DOM (the dimmed DNA screen behind), and both choice cards `next-choice-campaigns` / `next-choice-photoshoot` with their buzz pills.
- [ ] **Test B — start → routes correctly:** click `next-start-campaigns`; `waitForURL /\/campaigns$/`. (Re-seed/return and repeat for `next-start-photoshoot` → `/photoshoot` in a second test.)
- [ ] **Test C — dashboard fallback + Esc:** `goto /onboarding/next`; click `next-dashboard-link` → `/campaigns`. In a separate assertion, `goto /onboarding/next`, press `Escape`, assert it navigates to `/campaigns` (the modal close → dashboard fallback).
- [ ] **Test D — keyboard nav between steps:** `goto /onboarding/input`; press `ArrowRight`; assert URL advances to the next step (`/onboarding/processing` or whatever `nextStep('input')` returns); press `ArrowLeft`; assert it goes back. Ensure focus is on `body` (not an input) before pressing.
- [ ] **Verify + commit** `test(e2e): onboarding whats-next modal + keyboard nav`.

---

## Task 6: `e2e/90-mobile-shell.spec.ts`

Covers §0.5/§8 — mobile shell switch, tab nav, Modal→BottomSheet swap. Uses a 390px viewport.

**Files:** Create `e2e/90-mobile-shell.spec.ts`.

- [ ] **beforeEach:** reset + onboarding complete.
- [ ] Use `test.use({ viewport: { width: 390, height: 844 } })` for this describe block.
- [ ] **Test A — mobile shell renders below breakpoint:** `signInToApp`; `goto /campaigns`; assert `mobile-tab-bar` visible and the desktop sidebar is NOT visible (assert the desktop sidebar's identifying element is hidden — find a stable desktop-only selector in `Sidebar.tsx`/`Shell.tsx`, add a `data-testid="desktop-sidebar"` to it in Task 1 if none exists). Assert a `fab` is visible on the campaigns list.
- [ ] **Test B — tab navigation:** click `mobile-tab-shoot` → `waitForURL /\/photoshoot$/`; click `mobile-tab-brand` → `/brand`; assert `mobile-tab-bar` still present on each.
- [ ] **Test C — Modal swaps to BottomSheet on mobile:** navigate to a screen with a modal trigger that works on mobile (e.g. the product picker or ad-hoc generate — pick one reachable on a 390px screen, e.g. `/brand/assets` → `open-generate-modal`/`-empty`). Open it; assert `bottom-sheet` is present (NOT the centered desktop dialog). Close it (Esc) and assert it dismisses.
- [ ] **Verify + commit** `test(e2e): mobile shell nav + bottom-sheet swap`.

> Note: Task 1 must also add `data-testid="desktop-sidebar"` to the desktop sidebar root (for Test A's hidden-assertion) — fold that into Task 1's shell changes.

---

## Sequencing & notes

- Order: **Task 0 → Task 1 → Tasks 2–6** (2–6 are independent of each other; 2/3 depend on Task 0's `seedDoneCampaign`; all depend on Task 1's testids).
- **Run environment:** these specs need the Civitai dev server + `vitrine_test` DB. If the executing environment can't reach `CIVITAI_BASE_URL`, the specs are still authored, typechecked, and committed; note in each task's report that a live `pnpm test:e2e` run was/wasn't possible. Where possible, at least boot `pnpm test:server` + run the single new spec via `pnpm test:e2e --grep`.
- **Selector discipline:** specs select only on the testids added in Task 1 + role/text already used by the suite. No brittle CSS selectors.
- **DB-assert preference:** assert side-effects via the db helpers (`countTileVersions`, `countRows('generations'|'buzz_events')`, `getTile`) in addition to UI assertions — these new features are data-mutating and that's where the risk is.
- After all tasks: run the FULL `pnpm test:e2e` once (if the env allows) to confirm no cross-spec ordering issues (workers:1, shared MSW workflow store — each spec resets user data; that's sufficient).

## Coverage map
- §3.6 creative editor → Task 2 · §3.7 version history → Task 3 · §4.3 per-template regenerate → Task 4 · §2.5/§2.6 onboarding next + keyboard → Task 5 · §0.5/§8 mobile shell → Task 6. Enablers: Task 0 (db helpers) + Task 1 (testids).
