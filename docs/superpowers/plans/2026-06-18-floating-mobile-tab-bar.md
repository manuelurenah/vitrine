# Floating Mobile Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile bottom tab bar a floating, fixed pill anchored to the viewport bottom (iOS-26 style) so users never have to scroll to reach navigation.

**Architecture:** Anchor the mobile `ScreenFrame` to the dynamic viewport height (`h-dvh`) so the inner content region scrolls and the existing `absolute`-positioned tab bar pins to the visible bottom (app-frame model). Restyle `MobileTabBar` as a floating rounded pill with an inset volt capsule behind the active tab, respecting iOS safe-area insets. Desktop shell is untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind 3.4, Playwright e2e (against MSW-mocked Civitai + isolated test DB).

**Spec:** `docs/superpowers/specs/2026-06-18-floating-tab-bar-design.md`

## Global Constraints

- Mobile-only change: viewport `max-width: 767px`. Do NOT touch `src/components/shell/Shell.tsx` or `Sidebar.tsx` (desktop).
- Preserve all existing `data-testid` values: `mobile-tab-bar`, `mobile-tab-campaigns`, `mobile-tab-shoot`, `mobile-tab-animate`, `mobile-tab-brand`, `screen-frame`, `screen-sticky-cta`.
- Preserve accessibility: `aria-label`, `aria-current="page"` on the active tab, and `min-h-[44px]` touch targets.
- Use existing design tokens, not arbitrary colors: capsule = `bg-volt-soft` (`--volt-soft` = `rgba(0,255,157,0.12)`), border = `border-line-subtle`, active text = `text-volt`, glow = `var(--volt-glow)`.
- Tailwind is `^3.4.17` — `h-dvh` is available.
- Pill geometry constants (keep consistent across files): height `64px`, edge inset `12px`, corner radius `28px`, capsule inset `6px` / radius `18px`. Bottom offset = `calc(env(safe-area-inset-bottom) + 12px)`. Content clearance baseline = `64 + 12 = 76px`.
- e2e prerequisite: the Playwright harness needs the Civitai dev server (`testing-login` enabled) + test DB, per `README › End-to-end tests`. If the harness is unavailable in the execution environment, still write the tests, run `pnpm typecheck` + `pnpm build`, and verify visually via the `run` skill / Playwright MCP against local dev (`pnpm dev`).
- Do not modify `html, body` global height — the `h-dvh` frame fix makes it unnecessary.

---

### Task 1: Anchor the mobile frame to the viewport (fixes pinning)

This is the headline fix. With the frame bounded to the viewport, the existing `absolute bottom-0` bar already pins to the visible bottom even before the pill restyle.

**Files:**
- Modify: `src/components/shell/ScreenFrame.tsx` (root container className, ~line 63)
- Test: `e2e/90-mobile-shell.spec.ts` (append one test inside the existing `describe`)

**Interfaces:**
- Consumes: nothing new.
- Produces: a `ScreenFrame` whose root is `h-dvh` (viewport-bounded). No API/prop change.

- [ ] **Step 1: Write the failing test**

Append this test inside the existing `test.describe('mobile shell', ...)` block in `e2e/90-mobile-shell.spec.ts` (it inherits the `390×844` viewport and the `beforeEach` reset):

```ts
  test('tab bar is pinned to the viewport bottom without scrolling', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    const bar = page.getByTestId('mobile-tab-bar');
    await expect(bar).toBeVisible();

    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    const viewportHeight = page.viewportSize()!.height; // 844

    // The bar's bottom edge must sit at the bottom of the viewport (tolerance
    // covers the floating inset + headless safe-area = 0). Before the h-dvh fix
    // the frame collapses to content height, so the absolute-positioned bar
    // floats above the bottom (short page) or below the viewport (tall page) —
    // either way this range fails.
    const barBottom = box!.y + box!.height;
    expect(barBottom).toBeGreaterThan(viewportHeight - 90);
    expect(barBottom).toBeLessThanOrEqual(viewportHeight + 1);

    // On-screen without scrolling.
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y).toBeLessThan(viewportHeight);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "pinned to the viewport bottom"`
Expected: FAIL — `barBottom` is outside the asserted range because `ScreenFrame` collapses to content height (bar not at the viewport bottom).

- [ ] **Step 3: Apply the frame anchor**

In `src/components/shell/ScreenFrame.tsx`, change the root container's `h-full` to `h-dvh`:

```tsx
    <div
      data-testid="screen-frame"
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg-0 font-body text-fg-0"
    >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "pinned to the viewport bottom"`
Expected: PASS — bar bottom edge ≈ `844` (old geometry) within range.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/ScreenFrame.tsx e2e/90-mobile-shell.spec.ts
git commit -m "fix(mobile): anchor ScreenFrame to viewport so tab bar pins to bottom"
```

---

### Task 2: Restyle MobileTabBar as a floating volt + capsule pill

**Files:**
- Modify: `src/components/shell/MobileTabBar.tsx` (replace the `MobileTabBar` function body + its doc comment; remove the faux home indicator)
- Modify: `src/app/layout.tsx` (add `viewportFit: 'cover'` to the exported `viewport`)
- Test: `e2e/90-mobile-shell.spec.ts` (append one test)

**Interfaces:**
- Consumes: `ScreenFrame` is `h-dvh` (Task 1), so `absolute` positioning pins to the visible viewport bottom.
- Produces: a floating pill `nav` — `position: absolute`, `left-3 right-3`, `bottom: calc(env(safe-area-inset-bottom) + 12px)`, `height: 64`, `border-radius: 28px`. Active tab keeps `aria-current="page"` and gains an inset `bg-volt-soft` capsule. Same `Props { active: MobileTabId }`.

- [ ] **Step 1: Write the failing test**

Append inside the same `describe` block in `e2e/90-mobile-shell.spec.ts`:

```ts
  test('tab bar renders as a floating rounded pill with an active a11y marker', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    const bar = page.getByTestId('mobile-tab-bar');
    await expect(bar).toBeVisible();

    // Pill shape: 28px corner radius (was 0 on the old edge-to-edge bar).
    const radius = await bar.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('28px');

    // Floating: inset from both screen edges.
    const box = await bar.boundingBox();
    const viewportWidth = page.viewportSize()!.width; // 390
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThan(viewportWidth);

    // Active tab marked for a11y; siblings not.
    await expect(page.getByTestId('mobile-tab-campaigns')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('mobile-tab-shoot')).not.toHaveAttribute('aria-current', 'page');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "floating rounded pill"`
Expected: FAIL — `borderTopLeftRadius` is `0px` and the bar spans the full width (`box.x === 0`).

- [ ] **Step 3: Replace the MobileTabBar function**

In `src/components/shell/MobileTabBar.tsx`, replace the doc comment + the entire `MobileTabBar` function (from the `/** 76 px ... */` comment through the closing `}`) with:

```tsx
/**
 * Floating 64 px primary bottom tab bar (iOS-26 style pill).
 *
 * `position: absolute` inside a viewport-height ScreenFrame (`h-dvh`), inset
 * 12 px from the left/right edges and `calc(env(safe-area-inset-bottom) + 12px)`
 * from the bottom — so it floats above the content and clears the home
 * indicator on notched devices. Rounded 28 px pill, full border + elevation
 * shadow, backdrop blur.
 *
 * Active tab: inset `bg-volt-soft` capsule behind the column, with the volt
 * icon/label + glow on top. Touch targets stay min-h-[44px] (§8 prereq).
 */
export function MobileTabBar({ active }: Props) {
  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label="primary"
      className="absolute left-3 right-3 z-20 grid grid-cols-4 items-center rounded-[28px] border border-line-subtle backdrop-blur-[14px]"
      style={{
        height: 64,
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        background: 'rgba(15,15,22,0.94)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            data-testid={`mobile-tab-${tab.label}`}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[44px] flex-col items-center justify-center gap-[3px]',
              'text-[10.5px] font-medium tracking-[-0.005em] transition-colors duration-[120ms] ease-out',
              isActive ? 'text-volt' : 'text-fg-3 hover:text-fg-1',
            )}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-[6px] rounded-[18px] bg-volt-soft"
              />
            )}
            <span
              className={cn(
                'relative inline-flex',
                isActive && 'drop-shadow-[0_0_6px_var(--volt-glow)]',
              )}
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className="relative">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

Note: the faux iOS home-indicator `<span>` is intentionally removed (the OS draws the real one in the safe-area gap below the pill).

- [ ] **Step 4: Enable safe-area insets in the viewport meta**

In `src/app/layout.tsx`, add `viewportFit: 'cover'` to the exported `viewport`:

```ts
export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  viewportFit: 'cover',
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "floating rounded pill"`
Expected: PASS — radius `28px`, bar inset from edges, active a11y marker correct.

- [ ] **Step 6: Run the full mobile-shell spec (no regressions)**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts`
Expected: PASS — including the existing "navigates between sections" and "pinned to the viewport bottom" tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/MobileTabBar.tsx src/app/layout.tsx e2e/90-mobile-shell.spec.ts
git commit -m "feat(mobile): floating volt+capsule pill tab bar with safe-area insets"
```

---

### Task 3: Reserve content space + re-anchor the sticky CTA above the pill

`ScreenFrame` must pad its content so the last item clears the floating pill (plus safe-area), and the optional `stickyCta` must sit above the pill rather than at the old `bottom: 76`. (`stickyCta` has no consumer today, but the offset must be correct for when one is added.) This task also adds a `screen-content` testid to make the clearance assertable.

**Files:**
- Modify: `src/components/shell/ScreenFrame.tsx` (content padding calc + scroll-region testid + stickyCta `bottom`)
- Test: `e2e/90-mobile-shell.spec.ts` (append one test)

**Interfaces:**
- Consumes: pill geometry from Task 2 (height 64, inset 12 → 76px baseline).
- Produces: content scroll region with `data-testid="screen-content"` and `paddingBottom: calc(env(safe-area-inset-bottom) + <76 | 148>px)`; stickyCta at `bottom: calc(env(safe-area-inset-bottom) + 84px)`.

- [ ] **Step 1: Write the failing test**

Append inside the same `describe` block in `e2e/90-mobile-shell.spec.ts`:

```ts
  test('content region reserves space for the floating tab bar', async ({ page, baseURL }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns`);

    const content = page.getByTestId('screen-content');
    await expect(content).toBeVisible();

    // pill height (64) + edge inset (12) = 76, plus safe-area (0 in headless).
    const pb = await content.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(pb).toBeGreaterThanOrEqual(76);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "reserves space"`
Expected: FAIL — `getByTestId('screen-content')` matches no element (the scroll region has no testid yet).

- [ ] **Step 3: Update the content region + sticky CTA in ScreenFrame**

In `src/components/shell/ScreenFrame.tsx`, replace the `contentPb` constant and the content `<div>` with a safe-area-aware calc and the new testid. Change the constant (around line 58):

```tsx
  // Content bottom padding baseline: pill height (64) + edge inset (12) = 76,
  // plus the sticky CTA row (~72) when present. Safe-area is added in CSS.
  const contentPbBase = 76 + (stickyCta ? 72 : 0);
```

Replace the scrollable content `<div>` (the `relative z-[1] flex-1 ...` block) with:

```tsx
      {/* Scrollable content region */}
      <div
        data-testid="screen-content"
        className="relative z-[1] flex-1 overflow-x-hidden overflow-y-auto px-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${contentPbBase}px)` }}
      >
        {children}
      </div>
```

Then update the sticky CTA wrapper's inline `style` — replace `bottom: 76` with the pill-aware offset (inset 12 + height 64 + 8 gap = 84):

```tsx
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
            background: 'rgba(15,15,22,0.92)',
            boxShadow: '0 -8px 32px -12px rgba(0,0,0,0.5)',
          }}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:e2e e2e/90-mobile-shell.spec.ts -g "reserves space"`
Expected: PASS — `screen-content` paddingBottom ≥ 76px.

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed (build exercises the `viewport`/layout change from Task 2 and the security-header config path).

- [ ] **Step 6: Visual check**

Using the `run` skill (or Playwright MCP) against `pnpm dev`, open `/campaigns` at a 390×844 viewport and confirm: the pill floats with rounded corners above the bottom edge, the active tab shows the volt capsule, and the last list item is not hidden behind the pill. Capture a screenshot.

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/ScreenFrame.tsx e2e/90-mobile-shell.spec.ts
git commit -m "fix(mobile): reserve content space and anchor sticky CTA above floating pill"
```

---

## Self-Review

**Spec coverage:**
- Root-cause frame anchor (`h-dvh`) → Task 1. ✓
- Floating pill shape/elevation/insets → Task 2. ✓
- Volt + capsule active highlight → Task 2. ✓
- Remove faux home indicator → Task 2. ✓
- `viewportFit: 'cover'` for safe-area → Task 2. ✓
- Content bottom-padding clearance (+ safe-area) → Task 3. ✓
- Sticky CTA re-anchor → Task 3. ✓
- Preserve testids / a11y / 44px targets → constraints + Tasks 1–3. ✓
- Testing (Playwright + visual + typecheck/build) → all tasks. ✓
- Out of scope (desktop, animate route, tabs, global html/body height) → respected. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every run step has an exact command + expected result.

**Type consistency:** `Props { active: MobileTabId }` unchanged; geometry constants (64/12/28/6/18/76/84) used consistently across files; tokens `bg-volt-soft` / `border-line-subtle` / `text-volt` verified to exist; testids `screen-content` introduced in Task 3 and consumed only in Task 3's test.
