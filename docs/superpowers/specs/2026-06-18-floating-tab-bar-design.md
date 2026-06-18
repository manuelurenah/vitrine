# Floating fixed mobile tab bar (iOS-26 style) — design

**Date:** 2026-06-18
**Status:** Approved (design)
**Scope:** Mobile shell only (`max-width: 767px`). Desktop `Shell`/`Sidebar` untouched.

## Problem

On a mobile viewport the primary bottom tab bar is not pinned to the bottom of
the screen. Users must scroll the whole page to the end to reach it before they
can navigate. The bar should instead be a floating, fixed pill anchored to the
bottom of the viewport — in the spirit of the iOS-26 tab bar (rounded floating
container, active item highlighted with an inset capsule).

## Root cause

The mobile frame never establishes a viewport-bounded height:

- `html, body` (`src/app/globals.css`) set no `height: 100%`, and nothing else
  in the chain anchors viewport height.
- `AppShell` (mobile branch) renders `ScreenFrame`, whose root uses
  `h-full` (`height: 100%`). A percentage height resolves against the parent's
  height; with no defined ancestor height it computes to `auto` (content
  height).
- The frame therefore grows to its content height. `overflow-hidden` clips
  nothing useful and the inner `flex-1 overflow-y-auto` content region never
  receives a bounded box to scroll within, so the **whole document** scrolls.
- `MobileTabBar` is `position: absolute; bottom: 0` relative to `ScreenFrame`,
  so it pins to the bottom of the full-height frame — i.e. the bottom of the
  document, not the viewport. Hence: must scroll to see it.

Desktop is unaffected: `Shell` uses `h-screen` (`src/components/shell/Shell.tsx:15`).

## Approach

Chosen scroll model: **App-frame** (selected during brainstorming).

Anchor `ScreenFrame` to the dynamic viewport height (`h-dvh`). This bounds the
flex column to the visible viewport so the inner content region becomes the real
scroll box, the top bar and sticky CTA stay pinned, and the existing
`absolute`-positioned tab bar pins to the **visible** bottom automatically. The
bar is then restyled as a floating pill. Keeping the bar `absolute` inside a
`h-dvh` frame is visually identical to `position: fixed` but keeps it within the
frame's stacking/inset context (so the sticky-CTA offset stays simple).

Rejected alternative: making the bar `position: fixed`. It would escape the
frame's context and make the sticky-CTA offset and future frame transforms
fragile, for no benefit in this layout.

## Changes

### 1. `src/components/shell/ScreenFrame.tsx` — anchor the frame

- Root container: `h-full` → `h-dvh`. (Tailwind 3.4 ships `h-dvh`; the dynamic
  viewport unit also tracks the mobile URL-bar resize.)
- Recompute the content region's bottom padding so the last item clears the
  floating pill. New formula:
  `pillHeight (64) + bottomInset (12) + env(safe-area-inset-bottom) + (stickyCta ? 72 : 0)`.
  Implement as an inline `paddingBottom: calc(...)` including
  `env(safe-area-inset-bottom)`.
- Re-anchor the optional `stickyCta` above the floating pill:
  `bottom: calc(env(safe-area-inset-bottom) + 12px + 64px + 8px)`
  (replaces the hard-coded `bottom: 76`).

### 2. `src/components/shell/MobileTabBar.tsx` — floating volt + capsule pill

- Container positioning: inset from the edges — `left-3 right-3`,
  `bottom: calc(env(safe-area-inset-bottom) + 12px)`. Remains `absolute`
  (pins to the visible bottom inside the `h-dvh` frame).
- Shape & elevation: `rounded-[28px]`, height `64`, `grid grid-cols-4`. Replace
  the top-only border with a full `border border-line-subtle`, add an elevation
  shadow (`0 8px 32px -8px rgba(0,0,0,0.6)`), keep `backdrop-blur-[14px]` and the
  `rgba(15,15,22,0.94)` background.
- Active-tab highlight (volt + capsule): each tab column becomes `relative` and
  the active column renders an inset capsule behind its content —
  `absolute inset-[6px] rounded-[18px] bg-volt/[0.12]` (volt-tinted) — while the
  existing volt icon/label color + glow stay on top.
- Remove the faux iOS home-indicator `<span>`. On a floating pill it is
  redundant; the OS draws the real gesture indicator in the safe-area gap below
  the pill.
- Preserve all `data-testid` values (`mobile-tab-bar`, `mobile-tab-<label>`),
  `aria-current`, `aria-label`, and the `min-h-[44px]` touch targets.

### 3. `src/app/layout.tsx` — enable safe-area insets

- Add `viewportFit: 'cover'` to the exported `viewport` object. Without it,
  `env(safe-area-inset-bottom)` evaluates to `0` and the pill would sit on top of
  the home-indicator gesture area on notched devices.

## Components & boundaries

No new components. `MobileTabBar` stays a pure presentational nav (single prop:
`active: MobileTabId`). `ScreenFrame` keeps composing top bar → content → sticky
CTA → tab bar. Tab list, routes, and the `animate` 404 placeholder are unchanged.

Visual metrics (pill height 64, radius 28, inset 12, capsule tint volt/12%) are
the design constants; they live inline in `MobileTabBar`/`ScreenFrame` consistent
with the existing inline-style approach in those files.

## Testing

- **Playwright** (mobile viewport; extends the existing shell specs): assert
  `[data-testid="mobile-tab-bar"]` is within the viewport on initial load
  *without scrolling*, and remains at the same bottom offset after scrolling the
  content region. Existing `mobile-tab-*` testids are preserved so current specs
  keep passing.
- **Visual**: screenshot at an iPhone-class viewport (with notch/safe-area) to
  confirm the pill clears the safe area and the active capsule renders.
- `pnpm typecheck` (component + layout TypeScript).
- `pnpm build` (touches `viewport`/layout and the security-header config path).

## Out of scope

- Desktop `Shell` / `Sidebar`.
- The `animate` route (still a 404 placeholder by design).
- Tab set / route changes.
- Top-bar large-title collapse behavior.
- Global `html, body { height: 100% }` — the `h-dvh` frame fix makes it
  unnecessary.
