# User Preferences — Theme + Reduce Motion

**Date:** 2026-06-22
**Branch:** `feat/app-wide-motion`
**Status:** Approved design, ready for implementation plan

## Goal

Add a **preferences** section to the settings page letting users control:

- **Theme** — `system` · `light` · `dark`
- **Reduce motion** — `system` · `reduced` · `full`

Both default to `system`. Per-device persistence via `localStorage` (no DB,
no API route, no cross-device sync).

## Current state

Both features already half-exist; this work adds the missing UI + the
`system` option + an app-level motion override.

- **Theme** — Tailwind is `darkMode: ['selector', '[data-theme="dark"]']`.
  `globals.css` defines the dark palette under `:root` (default,
  `color-scheme: dark`) and a light palette under `[data-theme="light"]`
  (`color-scheme: light`). `src/app/layout.tsx` runs a tiny inline `<head>`
  no-flash script that reads `localStorage['vitrine-theme']` and sets
  `document.documentElement.dataset.theme` to `light`/`dark` (default dark).
  **There is no `system` option and no UI** — nothing currently writes the key,
  so every user is on the implicit dark default today.
- **Motion** — `src/app/layout.tsx` wraps the tree in
  `<MotionConfig reducedMotion="user">`, so OS `prefers-reduced-motion` is
  already honored. There is **no app-level override**.

## Decisions (locked)

1. **Persistence:** `localStorage`, per-device. Matches the existing
   `vitrine-theme` + no-flash-script pattern; no migration, no SSR flash.
2. **Theme default:** `system`. Users with no saved preference now resolve via
   `prefers-color-scheme` — a light-OS user sees the light theme by default.
   This is a deliberate behavior change from today's dark-first default.
3. **Motion control:** 3-way `system` / `reduced` / `full`, mirroring the theme
   picker. `system` preserves the current OS-follow behavior.
4. **Motion one-frame trade-off:** accepted (see Trade-offs).
5. **Tests:** unit + manual for now. Playwright e2e is a documented follow-up,
   not in scope for this pass.

## Architecture

### 1. Pure logic — `src/lib/preferences.ts` (new)

Single source of truth shared by the provider, the settings UI, and unit tests.

```ts
export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

export const THEME_KEY = 'vitrine-theme';
export const MOTION_KEY = 'vitrine-reduce-motion';

export const THEME_PREFS: readonly ThemePref[];   // for UI iteration
export const MOTION_PREFS: readonly MotionPref[];

// 'light' | 'dark' applied to documentElement.dataset.theme
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): 'light' | 'dark';

// maps to MotionConfig's reducedMotion prop
export function reducedMotionFor(pref: MotionPref): 'user' | 'always' | 'never';

// narrowing helpers for reading untrusted localStorage strings
export function asThemePref(v: string | null): ThemePref;   // fallback 'system'
export function asMotionPref(v: string | null): MotionPref;  // fallback 'system'
```

`resolveTheme`: `light`→`light`, `dark`→`dark`, `system`→ dark when
`systemPrefersDark` else light.
`reducedMotionFor`: `system`→`user`, `reduced`→`always`, `full`→`never`.

**Two-layer model:** stored value = the *preference*; `data-theme` only ever
holds the resolved `light`/`dark`. The UI reads the *preference* to highlight
the active segment, so "user picked system" stays distinct from "user picked
dark."

### 2. No-flash inline script — `src/app/layout.tsx` (edit)

Extend the existing inline script to handle the `system` state. Stays tiny and
synchronous so theme remains **flash-free**.

```js
(function(){try{
  var t = localStorage.getItem('vitrine-theme');           // 'system'|'light'|'dark'|null
  var resolved = (t === 'light' || t === 'dark') ? t
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark');
  document.documentElement.dataset.theme = resolved;
}catch(e){}})();
```

The `MOTION` preference is intentionally **not** read here — motion is a JS
context, not CSS, so there's nothing to apply pre-paint (see Trade-offs).

### 3. Client provider — `src/components/PreferencesProvider.tsx` (new)

Replaces the bare `<MotionConfig>` in `layout.tsx`. `'use client'`.

- Holds `{ theme, setTheme, reduceMotion, setReduceMotion }` in React context.
- `useState` initial values come from `localStorage` on the client (guarded for
  SSR; SSR defaults to `system`). Reconcile via `useEffect` on mount.
- `setTheme`: write `localStorage[THEME_KEY]`, recompute resolved theme, set
  `document.documentElement.dataset.theme` live.
- `setReduceMotion`: write `localStorage[MOTION_KEY]`, update state.
- Renders `<MotionConfig reducedMotion={reducedMotionFor(reduceMotion)}>` around
  `<ToastProvider>{children}</ToastProvider>` (preserves current nesting).
- When `theme === 'system'`, subscribe to
  `matchMedia('(prefers-color-scheme: dark)')` `change` events and re-resolve
  `data-theme` live. Clean up on unmount / pref change.

Export a `usePreferences()` hook for the settings UI.

`layout.tsx` change: swap `<MotionConfig reducedMotion="user">…</MotionConfig>`
for `<PreferencesProvider>…</PreferencesProvider>` (provider renders MotionConfig
internally).

### 4. Settings UI

- `src/app/(app)/settings/page.tsx` (server, edit): add a new section using the
  page's existing local `Card` shell:
  `<Card title="preferences"><PreferencesControls /></Card>`, placed after
  `brand` and before the `session` danger card.
- `src/components/settings/PreferencesControls.tsx` (new, `'use client'`):
  consumes `usePreferences()`; renders two labeled segmented controls — theme
  (`system`/`light`/`dark`) and motion (`system`/`reduced`/`full`). Styled to
  match the design system (mono uppercase labels, `volt` active state, the
  `border-line-subtle` / `bg-bg-*` tokens used elsewhere in settings). Changes
  apply instantly. A small inline `Segmented` helper inside this file is fine —
  no need for a shared primitive unless one already fits cleanly.

## Trade-offs

- **Motion one-frame (accepted):** theme is flash-free via the inline script;
  the motion override is applied on hydration through the provider. SSR starts
  at the current `user` behavior. Users on `system` (default + current behavior)
  see no change. A user who forced `reduced`/`full` may see the *first* entrance
  use default behavior for one load, then it sticks. Avoiding this needs
  hydration hacks (e.g. blocking SSR of animated children) we're choosing not to
  add.
- **Theme default flip (intended):** making `system` the default means existing
  users with no saved preference and a light OS now see the light theme. This is
  decision #2, not a regression.

## Out of scope

- DB persistence / cross-device sync.
- Per-component CSS `@media (prefers-reduced-motion)` guards — the app's motion
  is driven by the `motion` lib through `MotionConfig`, which the override
  already covers.
- Playwright e2e (documented follow-up).
- Any new settings beyond theme + reduce motion.

## Testing

- **Unit** (`src/lib/preferences.ts`): truth tables for `resolveTheme`,
  `reducedMotionFor`, `asThemePref`, `asMotionPref`.
- **typecheck:** `pnpm typecheck`.
- **Manual:** toggle each theme + motion option; confirm `data-theme` updates
  live, `system` follows OS scheme change, and both persist across reload.
- **Follow-up e2e (not now):** Playwright emulating `prefers-color-scheme` /
  `prefers-reduced-motion`, asserting segment selection sets `data-theme` and
  persists across reload.

## File summary

| File | Change |
|---|---|
| `src/lib/preferences.ts` | new — types, keys, pure resolvers + narrowers |
| `src/app/layout.tsx` | edit — extend no-flash script for `system`; swap `MotionConfig` for `PreferencesProvider` |
| `src/components/PreferencesProvider.tsx` | new — context + live theme apply + `MotionConfig` |
| `src/app/(app)/settings/page.tsx` | edit — add `preferences` Card section |
| `src/components/settings/PreferencesControls.tsx` | new — segmented theme + motion controls |
| `src/lib/preferences.test.ts` | new — vitest unit tests, co-located (`pnpm test:unit`) |
