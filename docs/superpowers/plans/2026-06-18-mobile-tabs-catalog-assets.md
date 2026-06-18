# Mobile Tabs: Catalog + Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile `animate` nav tab with `catalog` + `assets` tabs (5 tabs total), give the selected tab a taller capsule, and remove the dead `/brand/book` sub-tab.

**Architecture:** Pure mobile-shell/navigation change. `MobileTabBar` gains two tabs and drops `animate`; `AppShell` maps the new routes and stops rendering brand sub-tabs; `BrandSubTabs` is deleted; the desktop `Sidebar` loses two dead filter strings. No routes, DB, or generation features change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3.4, lucide-react icons, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-06-18-mobile-tabs-catalog-assets-design.md`

## Global Constraints

- Mobile-shell + nav only. Do NOT change route handlers, DB schema, or any generation feature.
- **Do NOT touch the post-gen `animate` action** (`PostGenActions`, `CreativeCard`, `CreativeEditor`), the `generation_source` enum value `'animate'`, or `/api/generations/[id]/images/[index]/animate`. This plan removes only the *navigation* `animate` tab.
- Final mobile tab order (left→right): campaigns · shoot · catalog · assets · brand.
- Icons (lucide-react): campaigns=`Megaphone`, shoot=`Camera`, catalog=`Package`, assets=`Images`, brand=`Dna`.
- Preserve the `mobile-tab-${label}` testid pattern, `aria-label`, `aria-current="page"` on the active tab, and `min-h-[44px]` touch targets.
- Pill height stays 64px; only the active capsule's vertical inset changes (`inset-[6px]` → `inset-x-[6px] inset-y-[3px]`). No content-padding / FAB / sticky-CTA offset changes.
- e2e harness (Civitai dev server + test DB) is available in this environment (verified in prior work). If an e2e run errors on environment/setup, do not block — report it and fall back to `pnpm typecheck`.

---

### Task 1: Mobile tab bar — drop animate, add catalog + assets, taller capsule

**Files:**
- Modify: `src/components/shell/MobileTabBar.tsx` (import, `MobileTabId`, `TABS`, grid cols, capsule inset, doc comment)
- Modify: `src/components/shell/AppShell.tsx` (`mobileTabFromPath` only)
- Test: `e2e/90-mobile-shell.spec.ts` (append one test)

**Interfaces:**
- Produces: `MobileTabId = 'campaigns' | 'photoshoot' | 'catalog' | 'assets' | 'brand'`; new testids `mobile-tab-catalog`, `mobile-tab-assets`. `mobileTabFromPath(pathname)` returns the new union, mapping `/catalog*`→`catalog`, `/assets*`→`assets`, brand as fallback.

- [ ] **Step 1: Write the failing test**

Append inside the existing `test.describe('mobile shell', ...)` block in `e2e/90-mobile-shell.spec.ts`:

```ts
  test('catalog and assets tabs navigate; animate tab is gone', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // The animate nav tab has been removed.
    await expect(page.getByTestId('mobile-tab-animate')).toHaveCount(0);

    // catalog tab → /catalog
    await page.getByTestId('mobile-tab-catalog').click();
    await page.waitForURL(/\/catalog$/, { timeout: 15_000 });
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // assets tab → /assets
    await page.getByTestId('mobile-tab-assets').click();
    await page.waitForURL(/\/assets$/, { timeout: 15_000 });
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "catalog and assets tabs navigate"`
Expected: FAIL — `mobile-tab-animate` currently exists (count 1) and `mobile-tab-catalog` is not found.

- [ ] **Step 3: Rewrite the MobileTabBar tab definitions**

In `src/components/shell/MobileTabBar.tsx`:

Replace the icon import (line 4):
```tsx
import { Camera, Dna, Images, Megaphone, Package } from 'lucide-react';
```

Replace the doc comment + `MobileTabId` type (lines 7-12) with:
```tsx
/** The five primary mobile tab keys, left→right in the bottom pill. */
export type MobileTabId = 'campaigns' | 'photoshoot' | 'catalog' | 'assets' | 'brand';
```

Replace the `TABS` array (lines 21-31) with:
```tsx
const TABS: TabDef[] = [
  { id: 'campaigns', label: 'campaigns', href: '/campaigns', icon: Megaphone },
  { id: 'photoshoot', label: 'shoot', href: '/photoshoot', icon: Camera },
  { id: 'catalog', label: 'catalog', href: '/catalog', icon: Package },
  { id: 'assets', label: 'assets', href: '/assets', icon: Images },
  { id: 'brand', label: 'brand', href: '/brand', icon: Dna },
];
```

- [ ] **Step 4: Widen the grid and grow the active capsule**

In the same file, change the nav grid from 4 to 5 columns (line 55): replace `grid-cols-4` with `grid-cols-5` inside the nav `className`.

Then change the active capsule inset (line 83): replace
```tsx
                className="absolute inset-[6px] rounded-[18px] bg-volt-soft"
```
with
```tsx
                className="absolute inset-x-[6px] inset-y-[3px] rounded-[18px] bg-volt-soft"
```

- [ ] **Step 5: Update mobileTabFromPath in AppShell**

In `src/components/shell/AppShell.tsx`, replace the `mobileTabFromPath` function (lines 19-25) with:
```tsx
/** Derive the active MobileTabBar tab from the current pathname. */
function mobileTabFromPath(pathname: string): MobileTabId {
  if (pathname === '/campaigns' || pathname.startsWith('/campaigns/')) return 'campaigns';
  if (pathname === '/photoshoot' || pathname.startsWith('/photoshoot/')) return 'photoshoot';
  if (pathname === '/catalog' || pathname.startsWith('/catalog/')) return 'catalog';
  if (pathname === '/assets' || pathname.startsWith('/assets/')) return 'assets';
  // brand/* and any unrecognised path → brand tab
  return 'brand';
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "catalog and assets tabs navigate"`
Expected: PASS.

- [ ] **Step 7: Run the full mobile-shell spec + typecheck**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts && pnpm typecheck`
Expected: all mobile-shell tests pass (the pinned / pill-shape / content-padding tests still key on `mobile-tab-campaigns`); typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/MobileTabBar.tsx src/components/shell/AppShell.tsx e2e/90-mobile-shell.spec.ts
git commit -m "feat(mobile): replace animate tab with catalog + assets, taller active capsule"
```

---

### Task 2: Remove /brand/book sub-tabs + tidy dead Sidebar strings

**Files:**
- Modify: `src/components/shell/AppShell.tsx` (remove brand sub-tab logic + import)
- Delete: `src/components/shell/BrandSubTabs.tsx`
- Modify: `src/components/shell/index.ts` (remove BrandSubTabs export)
- Modify: `src/components/shell/Sidebar.tsx` (remove dead filter strings)
- Test: `e2e/90-mobile-shell.spec.ts` (append one test)

**Interfaces:**
- Consumes: `mobileTabFromPath` / `MobileTabId` from Task 1 (unchanged here).
- Produces: `AppShell` mobile branch renders `<ScreenFrame active={activeTab} leadingLogo>{children}</ScreenFrame>` with no brand sub-tab strip; `BrandSubTabs` no longer exists.

- [ ] **Step 1: Write the failing test**

Append inside the same `describe` block in `e2e/90-mobile-shell.spec.ts`:

```ts
  test('brand view has no book sub-tab', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/brand`);

    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    // The brand sub-tab strip (dna · book) is removed entirely.
    await expect(page.locator('nav[aria-label="brand sections"]')).toHaveCount(0);
    // And there is no link to the removed /brand/book route anywhere.
    await expect(page.locator('a[href="/brand/book"]')).toHaveCount(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "no book sub-tab"`
Expected: FAIL — `BrandSubTabs` currently renders on `/brand`, so `nav[aria-label="brand sections"]` (count 1) and `a[href="/brand/book"]` (count 1) are present.

- [ ] **Step 3: Strip brand sub-tab logic from AppShell**

In `src/components/shell/AppShell.tsx`:

Remove the BrandSubTabs import line:
```tsx
import { BrandSubTabs, type BrandSubTabId } from './BrandSubTabs';
```

Remove the `brandSubTabFromPath` function entirely (the whole `/** Derive the active BrandSubTab ... */` comment + function, lines ~27-31).

Replace the mobile branch of `AppShell` (the `if (isMobile) { ... }` block) with:
```tsx
  if (isMobile) {
    const activeTab = mobileTabFromPath(pathname);

    return (
      <ScreenFrame active={activeTab} leadingLogo>
        {children}
      </ScreenFrame>
    );
  }
```

- [ ] **Step 4: Delete the BrandSubTabs component and its export**

```bash
git rm src/components/shell/BrandSubTabs.tsx
```

In `src/components/shell/index.ts`, remove the line:
```tsx
export { type BrandSubTabId, BrandSubTabs } from './BrandSubTabs';
```

- [ ] **Step 5: Tidy dead Sidebar filter strings**

In `src/components/shell/Sidebar.tsx`, replace the `workItems` filter (lines ~57-59):
```tsx
  const workItems = NAV.filter((n) =>
    ['campaigns', 'photoshoot', 'animate', 'brandbook'].includes(n.id),
  );
```
with:
```tsx
  const workItems = NAV.filter((n) => ['campaigns', 'photoshoot'].includes(n.id));
```

- [ ] **Step 6: Run the test + typecheck**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "no book sub-tab" && pnpm typecheck`
Expected: test PASS; typecheck clean (no stray `BrandSubTabs` / `BrandSubTabId` references remain).

- [ ] **Step 7: Run the full mobile-shell spec (no regressions)**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/AppShell.tsx src/components/shell/index.ts src/components/shell/Sidebar.tsx e2e/90-mobile-shell.spec.ts
git commit -m "feat(mobile): remove brand/book sub-tabs and tidy dead sidebar nav strings"
```

---

## Self-Review

**Spec coverage:**
- 5-tab set, drop animate, order campaigns·shoot·catalog·assets·brand → Task 1. ✓
- catalog=Package / assets=Images icons → Task 1. ✓
- grid-cols-4 → grid-cols-5 → Task 1. ✓
- Taller active capsule (inset-y-3) → Task 1. ✓
- mobileTabFromPath catalog/assets mapping → Task 1. ✓
- Delete BrandSubTabs + index export + AppShell sub-tab removal → Task 2. ✓
- Sidebar dead-string tidy → Task 2. ✓
- Preserve testids/a11y/touch targets → Global Constraints + Task 1. ✓
- Leave post-gen animate action / enum / API untouched → Global Constraints. ✓
- Tests (Playwright nav + animate-gone + no-book) + typecheck → both tasks. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact code; every run step has a command + expected result.

**Type consistency:** `MobileTabId` defined in Task 1 and consumed by `mobileTabFromPath` (Task 1) and `ScreenFrame`/`AppShell` props (unchanged). `BrandSubTabId`/`BrandSubTabs` are fully removed in Task 2 (component delete + index export + AppShell import all in the same task). Testids `mobile-tab-catalog`/`mobile-tab-assets` introduced in Task 1 match the `mobile-tab-${label}` pattern.
