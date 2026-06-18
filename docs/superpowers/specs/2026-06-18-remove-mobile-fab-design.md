# Remove mobile floating FAB — design

**Date:** 2026-06-18
**Status:** Approved (design)
**Scope:** Follow-on to the catalog+assets mobile-tabs branch (`feature/mobile-tabs-catalog-assets`). Mobile component CTAs only. No routes, DB, or generation features.

## Goal

Remove the floating FAB from every mobile list view. Each section keeps a create/upload entry — either an existing always-visible inline composer, or its header button surfaced on mobile — so no mobile create path is lost. The now-unused `FAB` component is deleted.

## Background (verified)

Four mobile-gated FAB usages, each `{isMobile && <FAB .../>}`:
- `CampaignsList.tsx:108` → `/campaigns/new`
- `PhotoshootList.tsx:157` → `/photoshoot/new`
- `CatalogGrid.tsx:69` → `/catalog/new`
- `AssetsGallery.tsx:311` → `/assets/new`

Mobile create paths without the FAB:
- **Campaigns** — `PromptComposer` (`CampaignsList.tsx:70`) is always visible. FAB redundant.
- **Photoshoot** — `PromptComposer` "design shoot" (`PhotoshootList.tsx:57`) is always visible. FAB redundant.
- **Catalog** — header "new product" link is `hidden sm:block` (`CatalogGrid.tsx:28`), so the populated view's only mobile create is the FAB → must un-hide the header link.
- **Assets** — `titleRow` CTAs (generate + upload) are `hidden …sm:flex` (`AssetsGallery.tsx:119`), so the populated view's only mobile create is the FAB → must un-hide the CTA row.

In all four files, `isMobile = useMediaQuery('(max-width: 767px)')` is used ONLY to gate the FAB, so it (and the `useMediaQuery` import) is removed with the FAB.

## Changes

### Per-list FAB removal
For each of `CampaignsList.tsx`, `PhotoshootList.tsx`, `CatalogGrid.tsx`, `AssetsGallery.tsx`:
- Remove the `{isMobile && <FAB .../>}` block and its `{/* Mobile FAB … */}` comment.
- Remove the `import { FAB } from '@/components/shell';` line.
- Remove the `const isMobile = useMediaQuery('(max-width: 767px)');` line and the `useMediaQuery` import (unused after FAB removal in each file).

### Surface header create on mobile (catalog + assets only)
- `CatalogGrid.tsx:28` — change the header link className `hidden sm:block` → `block` (visible on all sizes). Update the adjacent comment from "Desktop-only header button; mobile uses FAB" to reflect it is now the shared create entry.
- `AssetsGallery.tsx:119` — change the CTA wrapper className `hidden items-center gap-2 sm:flex` → `flex items-center gap-2`. Update the "Desktop CTAs" comment to "Create CTAs — Generate + Upload".

### Delete the FAB component
- Delete `src/components/shell/FAB.tsx`.
- Remove `export { FAB } from './FAB';` from `src/components/shell/index.ts`.

## Testing

- `e2e/90-mobile-shell.spec.ts`, the "renders the mobile shell below the breakpoint" test:
  - The current `await expect(page.getByTestId('fab')).toBeVisible();` (and its comment about the FAB) → replace with `await expect(page.getByTestId('fab')).toHaveCount(0);` (FAB removed everywhere).
  - Add: navigate to `/assets` on mobile and assert the populated/empty `open-generate-modal` CTA is now visible (`await expect(page.getByTestId('open-generate-modal')).toBeVisible();`) — proves the titleRow un-hide.
- `pnpm typecheck` — surfaces any stray `FAB` / `isMobile` / `useMediaQuery` reference left behind.

## Out of scope

- Desktop layouts (those header CTAs were already desktop-visible; un-hiding only adds mobile visibility).
- The `/campaigns/new`, `/photoshoot/new`, `/catalog/new`, `/assets/new` routes themselves.
- The safe-area work done on `FAB.tsx` in the prior branch (the file is deleted outright).
