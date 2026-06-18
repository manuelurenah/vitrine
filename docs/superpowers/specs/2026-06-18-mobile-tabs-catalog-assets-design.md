# Mobile tabs: catalog + assets, drop animate, remove brand/book — design

**Date:** 2026-06-18
**Status:** Approved (design)
**Scope:** Mobile shell navigation + a desktop dead-string tidy. No route handlers, no DB, no generation features.

## Goal

Replace the mobile `animate` tab (which links to a non-existent `/animate` page) with two real tabs — `catalog` and `assets` — and remove the dead `/brand/book` sub-tab from the brand view. Final mobile tab bar: **campaigns · shoot · catalog · assets · brand** (5 tabs).

## Background (verified)

- `/catalog/*` and `/assets/*` are already top-level routes under `src/app/(app)/`. No new routes needed.
- `/brand/` has only `page.tsx` — there is **no `/brand/book` route directory**. "book" exists only in shell UI (`BrandSubTabs` + `AppShell`'s `brandSubTabFromPath`).
- The desktop `Sidebar` already renders `dna · overview · catalog · assets` (brand group) + `campaigns · photoshoot` (work group). Its `workItems` filter still lists `'animate'` and `'brandbook'`, but neither exists in `NAV` (`nav.ts`), so they match nothing — dead strings.
- **Two distinct "animate" concepts.** This change removes ONLY the navigation `animate` tab. The post-generation `animate` *action* (image→video) in `PostGenActions` / `CreativeCard` / `CreativeEditor`, the `generation_source` enum value `'animate'`, and the `/api/generations/[id]/images/[index]/animate` route are a separate live feature and are **out of scope / untouched**.

## Changes

### 1. `src/components/shell/MobileTabBar.tsx` — 5 tabs, drop animate

- `MobileTabId` type → `'campaigns' | 'photoshoot' | 'catalog' | 'assets' | 'brand'` (remove `'animate'`).
- `TABS` (left→right):
  1. campaigns — `Megaphone` — `/campaigns`
  2. shoot — `Camera` — `/photoshoot`
  3. catalog — `Package` — `/catalog`
  4. assets — `Images` — `/assets`
  5. brand — `Dna` — `/brand`
  Remove the `animate`/`Video` entry and its 404 comment. Remove the now-unused `Video` import; add `Package`, `Images` to the `lucide-react` import.
- Container: `grid-cols-4` → `grid-cols-5`.
- New testids follow the existing `mobile-tab-${tab.label}` pattern: `mobile-tab-catalog`, `mobile-tab-assets`.
- Update the file's doc comment ("four primary tab keys") to reflect five tabs.

### 2. Active capsule — taller (more vertical padding when selected)

- In the active-tab capsule span, change `inset-[6px]` → `inset-x-[6px] inset-y-[3px]`. Capsule grows from ~52px to ~58px tall (more volt-soft space above/below the icon+label); horizontal inset unchanged. Pill height stays **64px**, so no content-clearance / FAB / sticky-CTA offset changes are needed.

### 3. `src/components/shell/AppShell.tsx` — route mapping + drop brand sub-tabs

- `mobileTabFromPath`: add mappings `/catalog` (and `/catalog/*`) → `'catalog'`, `/assets` (and `/assets/*`) → `'assets'`. Keep campaigns/photoshoot. `brand` remains the fallback for `/brand*` and any unrecognised path.
- Remove `brandSubTabFromPath`, the `BrandSubTabs` import, the `onBrand` / `brandSubTab` locals, and the `{onBrand && <BrandSubTabs .../>}` render. The mobile brand view renders `children` directly inside `ScreenFrame`.

### 4. Remove `/brand/book` entirely

- Delete `src/components/shell/BrandSubTabs.tsx` (AppShell was its only consumer).
- Remove its export line from `src/components/shell/index.ts` (`export { type BrandSubTabId, BrandSubTabs } ...`).
- No `/brand/book` route directory exists, so there is nothing else to delete.

### 5. `src/components/shell/Sidebar.tsx` — dead-string tidy

- Remove `'animate'` and `'brandbook'` from the `workItems` filter array, leaving `['campaigns', 'photoshoot']`. Zero behavior change (both already matched nothing); removes stale references to the removed concepts.

## Components & boundaries

No new components; one component deleted (`BrandSubTabs`). `MobileTabBar` and `AppShell` keep their existing prop shapes except `MobileTabId` gains/loses union members. `nav.ts` (desktop nav source) needs no change — it already lacks animate/brandbook and already has catalog/assets.

## Testing

- `e2e/90-mobile-shell.spec.ts`:
  - Extend the existing "tab bar navigates between sections" test to also tap `mobile-tab-catalog` (expect URL `/catalog`) and `mobile-tab-assets` (expect URL `/assets`), asserting `mobile-tab-bar` stays visible after each.
  - Add an assertion that the `animate` tab is gone: `await expect(page.getByTestId('mobile-tab-animate')).toHaveCount(0)`.
  - Existing pinned / pill-shape / content-padding tests stay green (still keyed on `mobile-tab-campaigns`, active on `/campaigns`).
- `pnpm typecheck` — the `MobileTabId` union change surfaces any unhandled reference; deleting `BrandSubTabs` surfaces any stray import.

## Out of scope

- Post-gen `animate` action, `generation_source` enum, animate API route.
- Desktop sidebar layout/grouping (beyond removing the two dead filter strings).
- Any `/catalog` or `/assets` page/route behavior — only the tabs that link to them.
- Tab-bar geometry (pill height, insets, safe-area) beyond the active-capsule vertical inset.
