# User Preferences (Theme + Reduce Motion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preferences section to the settings page letting users pick theme (system/light/dark) and reduce-motion (system/reduced/full), persisted per-device in localStorage.

**Architecture:** A pure `src/lib/preferences.ts` module (types + resolvers) is the single source of truth. A client `PreferencesProvider` replaces the bare `MotionConfig` in the root layout, owns the two prefs, applies the resolved theme to `documentElement` live, and feeds `reducedMotion` into `MotionConfig`. The existing inline no-flash `<head>` script is extended to resolve `system`. The settings page renders a client `PreferencesControls` (two segmented controls) inside its existing `Card` shell.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, `motion/react` (`MotionConfig`), Tailwind 3.4, Vitest.

## Global Constraints

- TypeScript strict — no `any`, no non-null hacks; every export fully typed.
- localStorage keys are exact: theme = `vitrine-theme` (reused, existing), motion = `vitrine-reduce-motion` (new).
- Both prefs default to `'system'` when unset or junk.
- `documentElement.dataset.theme` only ever holds resolved `'light' | 'dark'` (drives Tailwind `darkMode: ['selector','[data-theme="dark"]']` + `color-scheme`). The *preference* string lives only in localStorage + React state.
- Motion override flows through `MotionConfig reducedMotion` only — no CSS `@media` guards (out of scope).
- Unit tests are co-located `src/lib/*.test.ts`, run with Vitest (`node` env). Pure functions take their environment (system-prefers-dark, raw string) as params so they need no DOM.
- Commit messages: conventional, with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Already on branch `feat/app-wide-motion` — do not branch.

---

### Task 1: Pure preferences module

**Files:**
- Create: `src/lib/preferences.ts`
- Test: `src/lib/preferences.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ThemePref = 'system' | 'light' | 'dark'`
  - `type MotionPref = 'system' | 'reduced' | 'full'`
  - `const THEME_KEY = 'vitrine-theme'`, `const MOTION_KEY = 'vitrine-reduce-motion'`
  - `const THEME_PREFS: readonly ThemePref[]`, `const MOTION_PREFS: readonly MotionPref[]`
  - `resolveTheme(pref: ThemePref, systemPrefersDark: boolean): 'light' | 'dark'`
  - `reducedMotionFor(pref: MotionPref): 'user' | 'always' | 'never'`
  - `asThemePref(v: string | null): ThemePref`
  - `asMotionPref(v: string | null): MotionPref`

- [ ] **Step 1: Write the failing test**

Create `src/lib/preferences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  asMotionPref,
  asThemePref,
  MOTION_PREFS,
  reducedMotionFor,
  resolveTheme,
  THEME_PREFS,
} from './preferences';

describe('resolveTheme', () => {
  it('returns explicit light/dark unchanged regardless of system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('resolves system from systemPrefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('reducedMotionFor', () => {
  it('maps each pref to its MotionConfig value', () => {
    expect(reducedMotionFor('system')).toBe('user');
    expect(reducedMotionFor('reduced')).toBe('always');
    expect(reducedMotionFor('full')).toBe('never');
  });
});

describe('asThemePref', () => {
  it('passes through valid values', () => {
    expect(asThemePref('system')).toBe('system');
    expect(asThemePref('light')).toBe('light');
    expect(asThemePref('dark')).toBe('dark');
  });
  it('falls back to system for null or junk', () => {
    expect(asThemePref(null)).toBe('system');
    expect(asThemePref('purple')).toBe('system');
  });
});

describe('asMotionPref', () => {
  it('passes through valid values', () => {
    expect(asMotionPref('system')).toBe('system');
    expect(asMotionPref('reduced')).toBe('reduced');
    expect(asMotionPref('full')).toBe('full');
  });
  it('falls back to system for null or junk', () => {
    expect(asMotionPref(null)).toBe('system');
    expect(asMotionPref('slow')).toBe('system');
  });
});

describe('pref lists', () => {
  it('expose the full option sets in display order', () => {
    expect(THEME_PREFS).toEqual(['system', 'light', 'dark']);
    expect(MOTION_PREFS).toEqual(['system', 'reduced', 'full']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/lib/preferences.test.ts`
Expected: FAIL — cannot resolve `./preferences` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/preferences.ts`:

```ts
export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

export const THEME_KEY = 'vitrine-theme';
export const MOTION_KEY = 'vitrine-reduce-motion';

export const THEME_PREFS = ['system', 'light', 'dark'] as const satisfies readonly ThemePref[];
export const MOTION_PREFS = ['system', 'reduced', 'full'] as const satisfies readonly MotionPref[];

/** Resolved theme written to documentElement.dataset.theme. */
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Maps a motion pref to MotionConfig's `reducedMotion` prop. */
export function reducedMotionFor(pref: MotionPref): 'user' | 'always' | 'never' {
  switch (pref) {
    case 'reduced':
      return 'always';
    case 'full':
      return 'never';
    default:
      return 'user';
  }
}

/** Narrow an untrusted localStorage string to a ThemePref (fallback: system). */
export function asThemePref(v: string | null): ThemePref {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

/** Narrow an untrusted localStorage string to a MotionPref (fallback: system). */
export function asMotionPref(v: string | null): MotionPref {
  return v === 'reduced' || v === 'full' || v === 'system' ? v : 'system';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/lib/preferences.test.ts`
Expected: PASS — all 5 describe blocks green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/preferences.ts src/lib/preferences.test.ts
git commit -m "feat(preferences): pure theme + motion pref resolvers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: PreferencesProvider + layout wiring

**Files:**
- Create: `src/components/PreferencesProvider.tsx`
- Modify: `src/app/layout.tsx` (the `noFlashScript` constant on line ~20, and the `<body>` wrapper on lines ~33-37; the `MotionConfig` import on line 2)

**Interfaces:**
- Consumes (from Task 1): `THEME_KEY`, `MOTION_KEY`, `asThemePref`, `asMotionPref`, `resolveTheme`, `reducedMotionFor`, `ThemePref`, `MotionPref`.
- Produces:
  - `PreferencesProvider({ children }: { children: ReactNode })` — client component, renders `MotionConfig` internally.
  - `usePreferences(): { theme: ThemePref; reduceMotion: MotionPref; setTheme: (p: ThemePref) => void; setReduceMotion: (p: MotionPref) => void }`

> No automated unit test — this is DOM/React-context glue (consistent with the spec's "unit + manual" decision). Verification is `pnpm typecheck` + manual checks below.

- [ ] **Step 1: Create the provider**

Create `src/components/PreferencesProvider.tsx`:

```tsx
'use client';

import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  asMotionPref,
  asThemePref,
  MOTION_KEY,
  reducedMotionFor,
  resolveTheme,
  THEME_KEY,
  type MotionPref,
  type ThemePref,
} from '@/lib/preferences';

type PreferencesContextValue = {
  theme: ThemePref;
  reduceMotion: MotionPref;
  setTheme: (pref: ThemePref) => void;
  setReduceMotion: (pref: MotionPref) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveTheme(pref, systemPrefersDark());
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // SSR-safe defaults; reconciled from localStorage on mount.
  const [theme, setThemeState] = useState<ThemePref>('system');
  const [reduceMotion, setReduceMotionState] = useState<MotionPref>('system');

  // Hydrate persisted prefs once on mount.
  useEffect(() => {
    setThemeState(asThemePref(localStorage.getItem(THEME_KEY)));
    setReduceMotionState(asMotionPref(localStorage.getItem(MOTION_KEY)));
  }, []);

  // Keep data-theme correct; while on `system`, follow live OS scheme changes.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (pref: ThemePref) => {
    setThemeState(pref);
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      // localStorage unavailable (private mode / disabled) — keep in-memory only.
    }
    applyTheme(pref);
  };

  const setReduceMotion = (pref: MotionPref) => {
    setReduceMotionState(pref);
    try {
      localStorage.setItem(MOTION_KEY, pref);
    } catch {
      // localStorage unavailable — keep in-memory only.
    }
  };

  return (
    <PreferencesContext.Provider value={{ theme, reduceMotion, setTheme, setReduceMotion }}>
      <MotionConfig reducedMotion={reducedMotionFor(reduceMotion)}>{children}</MotionConfig>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
```

- [ ] **Step 2: Extend the no-flash script in `src/app/layout.tsx`**

Replace the `noFlashScript` constant (currently:
`const noFlashScript = `(function(){try{var t=localStorage.getItem('vitrine-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){}})();`;`)
with the `system`-aware version:

```ts
// Runs before first paint — reads localStorage and resolves the theme (incl.
// `system` via prefers-color-scheme) to avoid a flash of the wrong theme.
// Must stay tiny and inline.
const noFlashScript = `(function(){try{var t=localStorage.getItem('vitrine-theme');var r=(t==='light'||t==='dark')?t:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=r;}catch(e){}})();`;
```

- [ ] **Step 3: Swap MotionConfig for PreferencesProvider in `src/app/layout.tsx`**

Change the import on line 2 from:

```tsx
import { MotionConfig } from 'motion/react';
```

to:

```tsx
import { PreferencesProvider } from '@/components/PreferencesProvider';
```

Then change the `<body>` body from:

```tsx
<body className="bg-bg-0 text-fg-0 antialiased">
  <MotionConfig reducedMotion="user">
    <ToastProvider>{children}</ToastProvider>
  </MotionConfig>
</body>
```

to:

```tsx
<body className="bg-bg-0 text-fg-0 antialiased">
  <PreferencesProvider>
    <ToastProvider>{children}</ToastProvider>
  </PreferencesProvider>
</body>
```

(`ToastProvider` import stays. `ToastProvider` now lives inside the `MotionConfig` that `PreferencesProvider` renders — same nesting as before.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Manual smoke (dev server)**

Run: `pnpm dev`, open the app. Expected:
- App still renders; no hydration warnings in console for `data-theme`.
- `document.documentElement.dataset.theme` is `light` or `dark` matching OS scheme (no saved pref yet).
- In DevTools, set `localStorage['vitrine-theme'] = 'light'` then reload → light theme, no flash.

- [ ] **Step 6: Commit**

```bash
git add src/components/PreferencesProvider.tsx src/app/layout.tsx
git commit -m "feat(preferences): provider drives theme + motion, system-aware no-flash

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Settings preferences UI

**Files:**
- Create: `src/components/settings/PreferencesControls.tsx`
- Modify: `src/app/(app)/settings/page.tsx` (add an import; insert one `<Card>` between the `brand` Card and the `session` Card, ~line 139)

**Interfaces:**
- Consumes (Task 1): `THEME_PREFS`, `MOTION_PREFS`, `ThemePref`, `MotionPref`. (Task 2): `usePreferences`.
- Produces: `PreferencesControls()` — client component, no props.

> No automated unit test (interactive client UI). Verification: `pnpm typecheck` + manual.

- [ ] **Step 1: Create the controls component**

Create `src/components/settings/PreferencesControls.tsx`:

```tsx
'use client';

import { usePreferences } from '@/components/PreferencesProvider';
import { MOTION_PREFS, THEME_PREFS } from '@/lib/preferences';

export function PreferencesControls() {
  const { theme, reduceMotion, setTheme, setReduceMotion } = usePreferences();

  return (
    <div className="flex flex-col gap-4">
      <Segmented label="theme" value={theme} options={THEME_PREFS} onChange={setTheme} />
      <Segmented
        label="reduce motion"
        value={reduceMotion}
        options={MOTION_PREFS}
        onChange={setReduceMotion}
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-fit gap-1 rounded-[10px] border border-line-subtle bg-bg-1 p-1"
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                active ? 'bg-volt-soft text-volt' : 'text-fg-2 hover:bg-bg-3 hover:text-fg-0'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the import to `src/app/(app)/settings/page.tsx`**

Add alongside the other `@/components/settings` imports near the top:

```tsx
import { PreferencesControls } from '@/components/settings/PreferencesControls';
```

- [ ] **Step 3: Insert the preferences Card**

In `src/app/(app)/settings/page.tsx`, between the closing `</Card>` of the `brand` section and the `<Card title="session" tone="danger">` line, insert:

```tsx
<Card title="preferences">
  <PreferencesControls />
</Card>
```

(The local `Card` helper at the bottom of the file already provides the section shell — no changes to it.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Confirms the generic `Segmented` infers `T = ThemePref` / `MotionPref` and `onChange` matches `setTheme` / `setReduceMotion`.)

- [ ] **Step 5: Manual verification (dev server)**

Run: `pnpm dev`, visit `/settings`. Expected:
- A `// preferences` card shows two segmented controls: theme (system/light/dark), reduce motion (system/reduced/full), with the active segment in the volt accent.
- Click `light` → theme switches instantly; reload → still light (persisted).
- Click `dark` → switches; click `system` → follows OS.
- Click reduce-motion `reduced` → navigate between pages; entrance animations are suppressed on subsequent loads. `full` → animations always play. `system` → follows OS reduce-motion.
- `localStorage` holds `vitrine-theme` and `vitrine-reduce-motion` with the chosen values.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/PreferencesControls.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat(settings): preferences card — theme + reduce-motion controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- localStorage keys + `system` defaults → Task 1 (`THEME_KEY`/`MOTION_KEY`, `asThemePref`/`asMotionPref` fallback). ✅
- Pure `resolveTheme` / `reducedMotionFor` + unit tests → Task 1. ✅
- System-aware no-flash script → Task 2 Step 2. ✅
- Provider replacing `MotionConfig`, live theme apply, OS-scheme listener, motion override → Task 2. ✅
- Settings UI (Card + two segmented controls, instant apply) → Task 3. ✅
- Two-layer model (pref in storage/state, resolved in `data-theme`) → Task 1 + Task 2 `applyTheme`. ✅
- Motion one-frame trade-off (SSR default `system`→`user`, reconcile on mount) → Task 2 provider defaults + mount effect. ✅
- Out of scope (DB, CSS `@media`, e2e) → not planned. ✅

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every run step shows expected output. ✅

**Type consistency:** `ThemePref`/`MotionPref`, `THEME_KEY`/`MOTION_KEY`, `resolveTheme(pref, systemPrefersDark)`, `reducedMotionFor(pref)`, `asThemePref`/`asMotionPref`, `usePreferences()` shape — names/signatures identical across Tasks 1→2→3. ✅
