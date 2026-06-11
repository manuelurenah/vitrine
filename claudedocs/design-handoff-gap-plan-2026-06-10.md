# Design Handoff Gap Plan

> **Date:** 2026-06-10
> **Sources:** `design_handoff_vitrine/` (hi-fi mocks + README) vs. current `src/` implementation.
> **Goal:** Catalog every screen/component/state the design specifies that we don't ship today, so we can prioritize and tackle in follow-up PRs.
> **Status:** Audit only — no code changes proposed in this doc. Each gap lists the design source file, the current implementation path (or "none"), and the concrete missing pieces.

## How to read this

- ✅ done · ⚠️ partial · ❌ missing
- **Priority** = our call on impact, not designer's. Tweak per sprint planning.
- Mobile is tracked separately at the bottom — currently 0% across the board, and ranked as one big workstream.

---

## 0. Design system + shells

### 0.1 Tokens — ✅ done

`colors_and_type.css` ported verbatim into `src/app/globals.css`; `tailwind.config.ts` extends with all color/shadow/radius/font utilities mapping to CSS vars. Fonts (Bricolage Grotesque, Space Grotesk, JetBrains Mono) loaded via `next/font/google` in `src/app/fonts.ts`. Light theme `[data-theme="light"]` defined. No gaps.

### 0.2 Atoms — ✅ done

All in `src/components/ui/`: `Button` (4 variants × 3 sizes, bloom-volt-sm on primary), `IconButton`, `Chip` (active w/ check), `Badge` (live/gen/cooking/draft/archived w/ volt glow on live), `Avatar` (brand gradient variant), `BuzzPill` (compact + default), `Input` / `Textarea` / `FieldLabel`. No gaps.

### 0.3 Composite components

| Component | Status | Gaps |
|---|---|---|
| `PromptComposer` (`src/components/campaigns/PromptComposer.tsx`) | ⚠️ ~80% | Mic button missing. CTA label doesn't show inline buzz cost (design: `generate · 12 buzz`, current: `generate brief`). Gradient border + shadow OK. |
| `CreativeCard` (`src/components/campaigns/CreativeCard.tsx`) | ⚠️ ~70% | Animate/download shown always in footer — design wants hover-reveal overlay. Cooking overlay needs audit against design's volt-soft 36px circle + still sparkle (not animated). |
| `PastRow` (`src/components/campaigns/PastRow.tsx`) | ✅ done | 40px thumb, name, meta, badge, more — matches design. |
| `Modal` (`src/components/ui/Modal.tsx`) | ⚠️ partial | Scrim + Esc + outside-click OK. Open/close animation (fade + scale 96% → 100%) not configured. |
| `BottomSheet` | ❌ missing | Mobile equivalent of Modal. Not in codebase. |

### 0.4 Desktop shell — ✅ done

`Sidebar` (232px, hover/active states w/ inset volt left border, Buzz card, "new" badges on Animate/Book), `TopBar` (56px, breadcrumbs/back + search + BuzzPill + more), `Shell` (grid 232px + 1fr, content padding 28/36/60), `.bloom-bg` radials. Light theme has token plumbing but no toggle UI in TopBar/UserMenu yet. Icons using `lucide-react` correctly.

### 0.5 Mobile shell — ❌ entirely missing

Design specifies full mobile experience as a separate tree (not fluid responsive). None of the following exist in `src/components/shell/`:

- `MobileTopBar` — 52px sticky, `rgba(15,15,22,0.92)` + `blur(14px)`
- `MobileTabBar` — 76px absolute bottom, 4 tabs (`campaigns · shoot · animate · brand`), volt-active w/ drop-shadow + home indicator
- `ScreenFrame` — wrapper: topbar + scroll content + tab bar + optional bloom + optional sticky CTA
- `FAB` — 52px volt fill + label, volt bloom, bottom 92px / right 16px
- `BottomSheet` — drag handle, blurred scrim, slide-up
- `BrandSubTabs` — inner sub-tab strip under topbar inside Brand tab (DNA · Catalog · Assets · Book)
- Sticky CTA above tab bar for photoshoot builder (`generate · 60 buzz`)

**Icons not yet integrated:** `Mic` (composer), `Plus` (FAB).

---

## 1. Auth (Login)

**Design:** `design_files/Login.html`, `design_files/mobile-auth.jsx`
**Current:** `src/app/page.tsx`, `src/components/login/*`, `src/components/LoginButton.tsx`

### Desktop

- Layout, two-column, bloom backdrop, Civitai SSO primary, email disclosure: ✅ done.
- **Copy mismatch:** headline is `your brand, shot on demand.` — design specifies `one door. all your buzz.` (volt gradient on second line).
- **"Travels with you" rows:** design has 3 checked rows in pitch column; current has 4 different feature bullets.
- **Email disclosure expansion:** current is a button revealing form; design shows inline visual disclosure.
- **Responsive breakpoint:** design collapses at 960px; current uses Tailwind `lg:` (1024px).

### Mobile — ❌ missing

`MobileLogin` from `mobile-auth.jsx` (status badge "buzz · live" w/ volt dot, stacked pitch + auth card, footer metadata) not implemented. No separate mobile component; relies on responsive web only.

---

## 2. Onboarding

**Design:** `design_files/Onboarding.html`, `onboarding-app.jsx`, `onboarding-icons.jsx`, `onboarding.css`
**Current:** `src/app/onboarding/page.tsx`, `src/app/onboarding/[step]/page.tsx`, `src/components/onboarding/*`

5 screens: `welcome | input | generating | dna | next`.

### 2.1 Welcome — ⚠️ partial

- ✅ DNA icon pill, gradient headline, 3-step grid, CTA `let's go`, footer meta `~2 minutes · skip anything`.
- ❌ **Decorative SVGs in step cards** (DNA wave, campaign tile grid, photoshoot composition) replaced by solid gradient backgrounds.
- ⚠️ **Step card copy** drifts from design: design says "build your brand DNA / cook three reads / shoot, post, ship"; current says "tell us about your brand / we extract your dna / review and pick your first ship".
- ⚠️ Progress indicator: current uses elongated pill bars; design uses circular dots.

### 2.2 Input — ⚠️ partial

- ✅ Two-column form (URL + describe on left, logo dropzone + colors on right), 5 suggested swatches + custom, Analyze + Skip + Back footer.
- ⚠️ **"recommended" badge on URL card** is hidden on small screens — design shows it consistently.
- ⚠️ Eyebrow says `// step 1 of 3 · brand DNA` (mixed case) — design uses lowercase per voice rules.

### 2.3 Generating — ⚠️ partial

- ✅ Orb w/ DNA icon, gradient headline, status pill, skeleton preview, checklist of 5 tasks.
- ⚠️ **Task labels** should cycle through exactly: `reading your site` → `extracting palette` → `tasting your tone of voice` → `sketching your audience` → `naming the read`. Current uses similar but not identical wording — verify cycling timing (~850ms/task per design).
- ⚠️ **Animations not verified**: pulsing ring on orb (`pulse-ring` @ 2.4s + 1.2s delay), `dna-rotate` (360° / 6s linear), shimmer skeleton, scanner line (`scan` 0→100% / 2.6s ease-in-out).
- ⚠️ Eyebrow says `// extracting your brand dna` — design uses step-numbered eyebrow.

### 2.4 DNA reveal — ⚠️ partial

- ✅ Tabs (`brand overview | business details`), identity/logo/fonts/palette cards, editable chip groups for values/aesthetic/tone, business overview textarea, progress bar, `let's go` CTA.
- ❌ **Pencil edit indicators** on each card head — design shows small pencil icon; current relies on inline-edit affordance without visual cue.
- ⚠️ Eyebrow says `// step 2 of 3 · review` — design says `// dna reveal`.
- ⚠️ Progress: design shows static 100% complete; current is dynamic %.

### 2.5 What's next — ❌ structurally wrong

- Design: **modal** overlay on the faded DNA screen with 2 large choice cards (campaigns recommended + photoshoot), each w/ inline preview + buzz cost + `start →` link + footer alt link "or just drop me at the dashboard →".
- Current: standalone page route `/onboarding/next` that replaces the DNA screen.
- ❌ Modal overlay behavior + escape key + DNA shell hint behind scrim — none implemented.
- ❌ **Campaigns preview** in the choice card (3-post mini layout w/ colored backgrounds) — not rendered.
- ❌ **Photoshoot preview** (input photo + 4-shot grid) — not rendered.
- ❌ Footer alt link to dashboard.

### 2.6 Cross-cutting

- ❌ **Global keyboard nav** (← / → between screens, Esc to close modal) not wired at app level — design has app-level listener in `onboarding-app.jsx`.

### 2.7 Mobile — ❌ missing

All 5 mobile onboarding screens from `mobile-auth.jsx` absent.

---

## 3. Campaigns

**Design:** `Campaigns Hi-Fi.html`, `hifi-campaigns-screens-a.jsx`, `hifi-campaigns-screens-b.jsx`, `mobile-campaigns.jsx`
**Current:** `src/app/(app)/campaigns/*`, `src/components/campaigns/*`

7 desktop screens.

### 3.1 List — ✅ scope-reduced

- ✅ Hero (eyebrow/title/lede), `PromptComposer`, past campaigns table via `PastRow`.
- 🚫 **Suggestions grid** descoped 2026-06-10 — `SuggestionCard` + brand-DNA suggestions + refresh action will not ship.

### 3.2 Empty — ✅ scope-reduced

- ✅ Dashed empty card w/ "no campaigns yet" + `60 buzz` first-campaign cost copy (matches design verbatim).
- 🚫 Suggestions grid descoped — see §3.1.

### 3.3 Brief modal — ⚠️ ~65%

- Decision 2026-06-10: keep dedicated route `/campaigns/new`, adopt modal *look* (not overlay behavior).
- ❌ **Submitted-prompt sidecar box** (eyebrow + styled box showing the prompt that triggered the brief) missing.
- ⚠️ **Goal field**: design shows dropdown (`promote a new product ▼`); current is a text input.
- ✅ Title / description fields.
- ✅ Output format preset grid (`PresetGrid.tsx`) — 8 presets w/ aspect glyphs + check state matches design.
- ✅ Cost + confirm bottom strip.
- 🗑️ **Per-placement copy section** — drop. Not in design, descoped 2026-06-10.

### 3.4 Cooking — ⚠️ ~85%

- ✅ 3-col header (brief sidecar / center title + "X of Y still cooking" / right action stack w/ `gen` badge + share/download/more).
- ❌ **Filter pills** (`all 8 · ig·feed 3 · ig·story 1 · reels 1 · tiktok 1 · linkedin 2`) missing — no filtering UI in `CampaignDetail`.
- ✅ 4-col creative grid, three `CreativeCard` states (cooking / queued / done).

### 3.5 Ready — ⚠️ ~80%

- ✅ Same layout as cooking, `live` badge swap.
- ⚠️ Per-card animate/download shown always (in footer) — design wants hover overlay reveal.

### 3.6 Single creative editor — ❌ 0%

Entire route missing. Design (`hifi-campaigns-screens-b.jsx`) calls for:

- Route `/campaigns/:id/c/:creativeId` (or similar).
- Left column: version pill (history icon + `version 2 of 3` + ◀ ▶ chevrons), 4:5 canvas rendering the ad (eyebrow, headline, brand name, volt "shop now" pill), action bar (`fix layout · 3 buzz`, regenerate, download, share, animate).
- Right column: collapsible `PanelRow` for image / header / description / cta / logo / background.
- "Fix layout" promo card at bottom (sparkles, cost, description).
- Backend: tile field decomposition (header, description, cta, logo, background) — verify schema covers this.

### 3.7 Version history — ❌ 0%

Decision 2026-06-10: plan it. Schema work first — no `tile_versions` table today.

Route `/campaigns/:id/c/:creativeId/history` missing. Design calls for:

- Enhanced version pill, canvas w/ `v4 · current` badge in volt + bloom border.
- Strip of all 4 version thumbs w/ v-label + title + time.
- Right rail: "what changed in v4" diff (line-through old → new for header/cta; "unchanged" for unchanged fields).
- Actions: `restore v3`, `compare v3 vs v4`, `delete this version`.
- Backend prereqs: `tile_versions` table (FK → `tiles`, fields snapshot, created_at, generation_id), version-write hook on every cook/regenerate/fix-layout path, diff computation helper (`lib/tileVersions.ts`).

### 3.8 Mobile — ❌ missing

`mobile-campaigns.jsx` (37.6 KB) defines 7 mobile variants — none implemented.

---

## 4. Photoshoot

**Design:** `Photoshoot Hi-Fi.html`, `hifi-photoshoot-screens.jsx`, `mobile-photoshoot.jsx`
**Current:** `src/app/(app)/photoshoot/*`, `src/components/photoshoot/*`, `src/components/pickers/*`

3 desktop screens.

### 4.1 List — ⚠️ partial

- ✅ Hero, link to `/photoshoot/new`, past shoots grid.
- ⚠️ **Hero CTA card** lacks unified card container styling (icon bloom glow, gradient backdrop) — currently a Link + Button.
- ⚠️ **Grid layout**: design specifies 3-col max on desktop; current goes up to 5 cols (`xl:grid-cols-5`).
- ⚠️ **Card thumb aspect**: design uses uniform `1:1` 2×2 collage; current uses `aspect-[4/5]`.
- ⚠️ **Card meta** misses date — currently shows `{ratio} · {tiles.length} shots`.

### 4.2 Builder — ⚠️ significant gaps

- ✅ Two-step form (brief → review), subject picker, name + notes, template tiles, ratio chip selector, variants counter, fixed bottom bar, total shots calc, step dots.
- ❌ **Product radio list** in left column — design shows clean radio rows w/ SKU + selected-state styling (volt-soft bg + check). Current uses abstracted `SubjectPanel`.
- ❌ **"recommended for [product]" template group** w/ "based on brand dna" badge — design has this as the first group. Current hardcodes `['studio', 'lifestyle', 'hero']` only.
- ⚠️ **Template tile sizing** — design varies per group + respects aspect ratio; current is uniform 2-col responsive (`grid-cols-1 sm:grid-cols-2`).
- ⚠️ **Sticky bar** missing: estimate copy ("3 templates × 4 variants"), inline buzz cost on CTA (design: `generate · 60 buzz` on button), `|` section dividers.
- ⚠️ **Ratio chips**: design shows 3 (4:5, 9:16, 1:1); current has 4 (adds 16:9).

### 4.3 Results — ⚠️ major structural mismatch

- ✅ Per-template grouping, tile cards w/ cooking/queued/done, select mode + bulk actions, product picker dialog for bulk assign.
- ❌ **3-col header grid** (`280px 1fr 280px`) w/ left source-product card + center title + right action stack — current uses linear flex flow.
- ❌ **Source product card** as a distinct `bg-2` bordered card w/ product photo thumb + name + SKU + template chips (`// templates · 3` eyebrow + 3 active chips).
- ❌ **Filter chips** — design shows `all · {total} | studio · 4 | in use · 4 | contextual · 4` plus right-aligned `by template | grid` layout toggles.
- ❌ **Per-template regenerate action**: design shows `regenerate template · 20 buzz` link on each template heading row — entirely missing. Per-tile regenerate exists; per-group does not.
- ⚠️ **Grid breakpoints**: caps at 3 cols (`xl:grid-cols-3`); design wants 4.
- ⚠️ **Status copy**: missing clearer "X of Y ready · N still cooking" line.

### 4.4 Mobile — ❌ missing

`mobile-photoshoot.jsx` (23.7 KB) — 3 mobile variants, none implemented. Sticky CTA above tab bar particularly relevant for builder.

---

## 5. Catalog

**Design:** `Catalog & Assets.html`, `catalog-screens.jsx`, `catalog-assets-app.jsx`, `vitrine-shell.jsx`, `catalog-assets.css`, `mobile-catalog.jsx`
**Current:** `src/app/(app)/brand/catalog/*`, `src/components/catalog/*`

### 5.1 Catalog grid — ⚠️ partial

- ✅ Page head, action button to `/brand/catalog/new`, filter chips (all/live/archived), responsive grid, status badges, gradient thumbs for missing photos.
- ❌ **Sort dropdown** (`recent ▼`).
- ❌ **Grid/list segmented toggle**.
- ❌ **Photo-count badge** overlay on card images.
- ❌ **Per-card more (•••) menu** button.
- ⚠️ Filter set differs: design has `draft`; current has `archived`.

### 5.2 Catalog empty — ⚠️ heavily simplified

- ✅ Page head + dashed centered card.
- ❌ **Icon glyph** in volt-soft box w/ `Layers` icon (text only currently).
- ⏳ **Two-choice cards** "add from URL" (with globe icon + featured volt bloom) vs "add from scratch" (with plus) — deferred with URL scrape (§5.3). v1 routes straight to the single scratch form; revisit when URL scrape lands.
- ❌ **Fallback link** "or skip for now — upload to assets instead →".

### 5.3 Add product — ⚠️ partial

- Decision 2026-06-10: keep dedicated route `/brand/catalog/new`, adopt modal *look*.
- Decision 2026-06-11: URL scrape deferred to a later version — v1 is manual/scratch entry only. Mode tabs go with it (no URL mode → no tabs).
- ✅ Form: name, description, tags, single-photo upload.
- ⏳ **Mode tabs** (URL vs Scratch) — deferred, coupled to URL scrape.
- ⏳ **URL scrape "auto-fill" preview** (4 photo thumbs + checklist of detected fields) — deferred to later version.
- ❌ **Multi-photo grid** (2×2 cover + 4 singles, up to 8 photos).
- ❌ **"save as draft"** secondary action.

### 5.4 Catalog detail — ⚠️ partial

- ✅ Back button, status badge, action CTAs, hero image, photo strip, product name + tags + description + meta table.
- ⚠️ **Hero aspect**: design 4:3; current 1:1.
- ❌ **Photo edit (wand) / delete** controls on hero.
- ❌ **Position indicator** (`X / Y · cover`) overlay on hero.
- ❌ **Add photo / upload** buttons in strip.
- ❌ **"used in campaigns"** grid (campaign preview cards).
- ❌ **"start photoshoot"** CTA (current only has "use as photoshoot subject").
- ❌ **More (•••) menu**.

---

## 6. Assets

**Design:** `assets-screens.jsx`
**Current:** `src/app/(app)/brand/assets/*`, `src/components/assets/*`

### 6.1 Assets gallery — ⚠️ partial

- ✅ Page head, upload CTA, grouped sections by collection, 6-col asset tile grid.
- ❌ **Toolbar filter chips** w/ counts (`all · X · logos · X · partners · X · past campaigns · X · references · X`) — current shows static text summary.
- ❌ **Grid/list toggle**.
- ❌ **"view all →" link** per section.
- ❌ **Logo tile styling variants** (gradient / outline / volt mark renders for `L` wordmarks).
- ❌ **Partner tile styling** (centered name overlay).

### 6.2 Assets empty — ❌ heavily simplified

- ✅ Page head.
- ❌ **Icon glyph** + bloom in volt-soft box.
- ❌ **Gradient headline** with highlighted keyword.
- ❌ **Big dropzone area**.
- ❌ **"or pick a collection"** divider + 4 collection cards (logos / partners / past campaigns / references).
- ❌ **Fallback link** to catalog.

### 6.3 Assets upload — ⚠️ partial

- Decision 2026-06-10: keep dedicated route `/brand/assets/new`, adopt modal *look*.
- ✅ Form modal w/ dropzone, file list + progress, tags, collection assignment, description.
- ❌ **StagedFile** layout (thumb-sm + name + format/size + per-file progress) — current is simplified.
- ❌ **"X of Y uploaded"** status string in footer.

### 6.4 Asset lightbox — ✅ mostly done

- ✅ Fullscreen modal, breadcrumbs, action buttons, large preview, ◀ ▶ nav, right panel (metadata table + tags + CTA), horizontal thumb strip, keyboard nav (Esc, ←/→), edit/delete/download.
- ⚠️ Frame aspect may differ; thumb cell size differs from design's `72×56`.

---

## 7. Brand DNA, Brand Book, Settings

### 7.1 Brand DNA (`/brand`) — ⚠️ partial

`BrandEditor.tsx`:

- ✅ Page structure, all fields (name, description, sourceUrl, tone, industry, tagline, font, logo upload, palette w/ add/remove).
- 🚫 **Tabs** (overview | business details) — descoped 2026-06-10. No tabbed views in Brand DNA; single flat form (all fields inline) is the intended design. Current flat form matches.
- ❌ **Identity card** (logo wordmark + URL section).
- ❌ **Logo render preview** (e.g., "Lumen" wordmark in gradient).
- ❌ **Font family preview** (`Aa` sample + family name).
- ❌ **Palette swatch previews** w/ inline hex labels.
- ❌ **Editable chip groups** for values / aesthetic / voice — currently text inputs.
- ❌ **100% complete progress bar** at bottom.

### 7.2 Brand Book (`/brand/book`) — ❌ not designed yet

Sidebar surfaces `book` w/ "new" badge. README marks it as "open question / not yet designed". Placeholder only.

### 7.3 Settings (`/settings`) — ✅ ahead of design

Identity, Buzz balance + top-up link, OAuth scopes, default brand, sign out / revoke session — all present. README marks Settings as an open question; current impl exceeds design spec.

### 7.4 Buzz top-up / low-buzz / 0-buzz states — ⚠️ planned

Decision 2026-06-10: build **native top-up modal** instead of redirecting to Civitai.

- ❌ Native top-up modal: package tiers + Civitai Buzz purchase API call + success/error states. Request mocks from designer before build.
- ❌ Low-Buzz paywall ("low buzz. only X left. top up to keep generating."). Pending mocks.
- ❌ Empty (0) Buzz balance state. Pending mocks.
- ❌ Notifications / job-complete toasts. Pending mocks.

---

## 8. Mobile — ❌ workstream-wide

Decision 2026-06-10: **responsive single tree** — no `/m/*` routes. Mobile layouts branch under media queries inside the same route files. Design's mobile artboards inform composition, not routing.

24 mobile artboards in `Mobile Hi-Fi.html` (390px-wide), corresponding `mobile-*.jsx`:

- `mobile-auth.jsx` — login + 5 onboarding
- `mobile-campaigns.jsx` — list, brief sheet, cooking, ready, editor, history (7)
- `mobile-photoshoot.jsx` — list, builder, results (3)
- `mobile-catalog.jsx` — catalog (4) + assets (4)
- `mobile-shell.jsx` — `ScreenFrame`, `MobileTopBar`, `MobileTabBar`, `BottomSheet`, `FAB`, `MobileBuzzPill`, `MobileProductShot`, `MobileSectionHead`

**Current state:** 0%. Desktop-only implementation; responsive collapse is incidental, not designed.

**Prereqs before any mobile screen lands:**

1. Mobile shell components (§0.5) — `ScreenFrame`, `MobileTopBar`, `MobileTabBar`, `FAB`, `BottomSheet`, `BrandSubTabs`, sticky CTA slot. Rendered conditionally below a viewport breakpoint inside `(app)/layout.tsx`.
2. Touch-target sizing (recommend ≥44px; current atoms are 36–38px).
3. Modal → BottomSheet swap at the same breakpoint inside `Modal.tsx`.

---

## 9. Priority ranking (suggested)

### Critical (blocks intended core UX)
1. **Campaigns single creative editor** (§3.6) — entire feature absent.
2. **Campaigns version history** (§3.7) — entire feature absent.
3. **Photoshoot per-template regenerate** (§4.3) — surfaced action missing.
4. **Onboarding "what's next" modal** (§2.5) — should overlay DNA, not replace it.
5. **Mobile shell** (§0.5) — unblocks all mobile work.

### High (visible polish + intended UX)
6. **Filter pills** on Cooking/Ready (§3.4) and Photoshoot Results (§4.3).
7. **Brief modal look** on dedicated route (§3.3) — adopt modal styling, drop per-placement copy section.
8. **Add product** multi-photo grid on dedicated route (§5.3). URL scrape + mode tabs deferred to a later version.
9. **Native Buzz top-up modal** (§7.4) — request mocks first.
10. **Empty states** for Catalog (§5.2) and Assets (§6.2) — icon glyphs, choice cards, fallback links.
11. **Brand DNA chip groups + previews** (§7.1) — tabs descoped, flat form stays.
12. **Photoshoot builder** — recommended group + inline buzz cost on CTA + estimate copy (§4.2).
13. **Inline buzz cost on all CTAs** (PromptComposer, photoshoot generate) — voice rule from README.
14. **Login copy fix** (§1) — match "one door. all your buzz."

### Medium (interaction + state)
15. **Hover-reveal animate/download** on `CreativeCard` (§3.5).
16. **Modal open/close animations** (fade + scale, slide-up on mobile).
17. **Global onboarding keyboard nav** (← / →) + Esc on next modal (§2.6).
18. **Cooking overlay style audit** vs design's still-sparkle 36px volt-soft circle (§0.3).
19. **Photoshoot list grid cap** (3 cols max) + uniform square thumbs (§4.1).
20. **Catalog detail polish** — 4:3 hero, photo controls, position indicator, used-in-campaigns grid (§5.4).
21. **Sort + grid/list toggles** on Catalog/Assets grids (§5.1, §6.1).

### Low (copy + minor visual drift)
22. **Onboarding step card decorative SVGs** (§2.1).
23. **Step copy + eyebrow consistency** across onboarding (§2.1–2.4).
24. **Progress dots vs pills** (§2.1).
25. **Pencil edit indicators** on DNA cards (§2.4).
26. **Light theme toggle UI** in TopBar (§0.4).
27. **Logo + partner tile variants** on Assets gallery (§6.1).
28. **`?s=` deep-link state** on Catalog/Assets (mostly internal nav nicety; current Next routes are fine).

### Deferred (waiting on design)
- Brand Book (§7.2).
- Low-Buzz paywall, 0-Buzz state, notifications / toasts (§7.4) — top-up modal itself is High (#9), but the surrounding states still need mocks.

### Deferred (later version)
- **Catalog add-from-URL scrape** (§5.3, §5.2) — auto-fill from product URL + mode tabs + two-choice empty card deferred; v1 ships manual/scratch entry only.

### Descoped (2026-06-10)
- **Suggestions on Campaigns list** (§3.1) + `SuggestionCard`.
- **Per-placement copy section** in brief flow (§3.3).
- **Brand DNA tabbed views** (§7.1) — single flat form instead.
- **Animate workspace** — out of scope, sidebar/tab "new" placeholder stays for now but no work planned.
- **Mobile dual-tree (`/m/*`)** — going responsive (§8).

---

## 10. Decisions (resolved 2026-06-10)

| # | Question | Decision | Affects |
|---|---|---|---|
| 1 | Brief modal: overlay or dedicated route? | Keep dedicated route `/campaigns/new`, adopt modal look. | §3.3 |
| 2 | Add-product / upload-assets: page or modal? | Keep dedicated routes, adopt modal look. | §5.3, §6.3 |
| 3 | Per-placement copy in brief flow? | Drop. | §3.3 |
| 4 | Mobile delivery: `/m/*` or responsive? | Responsive single tree. | §8 |
| 5 | Animate workspace this quarter? | Skip — descoped. | §9 Descoped |
| 6 | Per-tile versions in schema? | Plan version history; schema work (`tile_versions`) required first. | §3.7 |
| 7 | Sidebar Buzz "top up"? | Build native top-up modal; request mocks. | §7.4, §9 High #9 |
| 8 | Tabbed views in Brand DNA? | Drop — single flat form, no tabs. | §7.1 |
| 9 | Catalog add-from-URL scrape? | Defer to a later version; v1 manual/scratch only. Mode tabs deferred with it. | §5.3, §5.2 |
