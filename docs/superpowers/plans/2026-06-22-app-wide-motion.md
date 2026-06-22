# App-wide Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a consistent, enter-only, app-wide motion language built on Motion (`motion/react`) across the Vitrine user journey.

**Architecture:** A single motion-token layer (`src/components/ui/motion/tokens.ts`) feeds a handful of thin client primitives (`FadeIn`, `Reveal`, `Stagger`, `PageTransition`, `TileReveal`, `MotionNumber`). A single global `<MotionConfig reducedMotion="user">` in the root layout makes every animation respect `prefers-reduced-motion` with no per-component branching. Surfaces consume the primitives additively; nothing animates on exit.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind 3.4, **Motion** (`motion/react`), Vitest (`environment: 'node'`, tests via `renderToStaticMarkup` — no jsdom, no `@testing-library`), Playwright (e2e).

## Global Constraints

Every task's requirements implicitly include this section. Values are verbatim from the design spec (`docs/superpowers/specs/2026-06-22-app-wide-motion-design.md`).

- **Library:** Motion (`motion/react`) only. anime.js is NOT adopted.
- **Enter-only:** No exit animations anywhere. Never use `AnimatePresence` for exit; outgoing content unmounts immediately.
- **Reduced motion:** A single global `<MotionConfig reducedMotion="user">`. No per-component reduced-motion branching.
- **Tiered tokens:** All durations / easings / springs come from `motionTokens`. No inline magic-number durations in surfaces.
- **Keep existing CSS:** The onboarding `@keyframes` (`pulse-ring`, `dna-rotate`, `shimmer`, `scan`, `dot-pulse`) stay as ambient loops. `Modal` / `BottomSheet` / `Toast` keep their current CSS transitions — untouched.
- **Poll guard:** Cooking/result surfaces long-poll and re-render every tick. Entrance animations MUST fire once per item (keyed / mount-only), never on each poll.
- **Preserve test hooks:** Keep every existing `data-testid`, `aria-*` attribute, and touch-target class on modified components.
- **Client-only:** Motion runs on the client. Primitives are `'use client'`.
- **Test env reality:** Vitest is `environment: 'node'`. Unit-test pure logic (token values, poll-guard helper). For components, use `renderToStaticMarkup` and assert children/markup presence. Runtime animation (RAF/transforms) is NOT unit-testable here — verify via `pnpm typecheck`, manual reduced-motion check, and `pnpm test:e2e`.

---

# Phase 0 — Foundation

## Task 1: Add `motion` dependency + motion-token layer

**Files:**
- Modify: `package.json` (add `motion` to `dependencies`)
- Create: `src/components/ui/motion/tokens.ts`
- Test: `src/components/ui/motion/tokens.test.ts`

**Interfaces:**
- Produces: `motionTokens` (object with `feedback`, `transition`, `hero` keys), and variant objects `fadeUp`, `scaleIn` — consumed by every primitive in Tasks 3–5.

- [ ] **Step 1: Install the dependency**

Run:
```bash
pnpm add motion
```
Expected: `motion` appears under `dependencies` in `package.json`; lockfile updated.

- [ ] **Step 2: Write the failing test**

Create `src/components/ui/motion/tokens.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fadeUp, motionTokens, scaleIn } from './tokens';

describe('motionTokens', () => {
  it('exposes the three intensity tiers', () => {
    expect(Object.keys(motionTokens).sort()).toEqual(['feedback', 'hero', 'transition']);
  });

  it('feedback is faster than transition', () => {
    expect(motionTokens.feedback.duration).toBeLessThan(motionTokens.transition.duration);
  });

  it('hero is a spring', () => {
    expect(motionTokens.hero.type).toBe('spring');
  });

  it('fadeUp animates opacity and y, hidden→show', () => {
    expect(fadeUp.hidden).toEqual({ opacity: 0, y: 8 });
    expect(fadeUp.show).toEqual({ opacity: 1, y: 0 });
  });

  it('scaleIn animates opacity and scale', () => {
    expect(scaleIn.hidden.opacity).toBe(0);
    expect(scaleIn.hidden.scale).toBeLessThan(1);
    expect(scaleIn.show.scale).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/motion/tokens.test.ts`
Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 4: Write the implementation**

Create `src/components/ui/motion/tokens.ts`:
```ts
import type { Transition, Variants } from 'motion/react';

/**
 * Single source of truth for motion timing, mirroring how globals.css is the
 * single source for color/spacing tokens. Three intensity tiers:
 *  - feedback   : repeated/utility surfaces (hovers, taps, selection)
 *  - transition : content entrance, route/wizard/step changes
 *  - hero       : rare/expressive moments (login, result reveal, buzz spend)
 */
export const motionTokens = {
  feedback: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  hero: { type: 'spring', stiffness: 320, damping: 26 },
} as const satisfies Record<string, Transition>;

/** Shared enter-only variants. No `exit` key — exits are intentionally omitted. */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
} as const satisfies Variants;

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1 },
} as const satisfies Variants;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/motion/tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/motion/tokens.ts src/components/ui/motion/tokens.test.ts
git commit -m "feat(motion): add motion dep and token layer"
```

---

## Task 2: Poll-guard helper (`diffArrived`)

The single most important correctness rule: cooking/result surfaces re-render every poll tick, so entrance animations must fire once per item. This pure helper computes which ids are newly arrived given the set already seen.

**Files:**
- Create: `src/components/ui/motion/diffArrived.ts`
- Test: `src/components/ui/motion/diffArrived.test.ts`

**Interfaces:**
- Produces: `diffArrived(seen: ReadonlySet<string>, current: readonly string[]): string[]` — returns ids in `current` not in `seen`, preserving `current` order. Consumed by Task 9 (cooking reveal) and reused by Task 8 (grids).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/motion/diffArrived.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { diffArrived } from './diffArrived';

describe('diffArrived', () => {
  it('returns all ids when nothing has been seen', () => {
    expect(diffArrived(new Set(), ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns only ids not already seen, preserving order', () => {
    expect(diffArrived(new Set(['a', 'c']), ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
  });

  it('returns empty when every current id was already seen (steady-state poll)', () => {
    expect(diffArrived(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
  });

  it('ignores seen ids that are no longer current', () => {
    expect(diffArrived(new Set(['x']), ['a'])).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/motion/diffArrived.test.ts`
Expected: FAIL — `Cannot find module './diffArrived'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/motion/diffArrived.ts`:
```ts
/**
 * Ids present in `current` but not yet in `seen`, in `current` order.
 * Used to fire an entrance animation exactly once per item across the repeated
 * re-renders of a long-polling surface.
 */
export function diffArrived(seen: ReadonlySet<string>, current: readonly string[]): string[] {
  return current.filter((id) => !seen.has(id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/motion/diffArrived.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/motion/diffArrived.ts src/components/ui/motion/diffArrived.test.ts
git commit -m "feat(motion): add diffArrived poll-guard helper"
```

---

## Task 3: Entrance primitives — `FadeIn`, `Reveal`, `Stagger`

**Files:**
- Create: `src/components/ui/motion/Reveal.tsx`
- Create: `src/components/ui/motion/Stagger.tsx`
- Test: `src/components/ui/motion/Reveal.test.tsx`

**Interfaces:**
- Produces:
  - `FadeIn(props: { children: ReactNode; className?: string; delay?: number })` — opacity-only entrance.
  - `Reveal(props: { children: ReactNode; className?: string; tier?: 'transition' | 'hero'; delay?: number })` — `fadeUp` entrance at the given tier (default `transition`).
  - `Stagger(props: { children: ReactNode; className?: string; gap?: number })` — parent that staggers direct `Reveal`/`FadeIn` children by `gap` seconds (default `0.06`).
- Consumed by Tasks 8, 12, 13, 15.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/motion/Reveal.test.tsx`:
```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FadeIn, Reveal } from './Reveal';
import { Stagger } from './Stagger';

describe('Reveal / FadeIn', () => {
  it('renders its children (SSR markup passthrough)', () => {
    const html = renderToStaticMarkup(<Reveal>hello-reveal</Reveal>);
    expect(html).toContain('hello-reveal');
  });

  it('applies a passed className to the wrapper', () => {
    const html = renderToStaticMarkup(<FadeIn className="probe-class">x</FadeIn>);
    expect(html).toContain('probe-class');
  });
});

describe('Stagger', () => {
  it('renders all children in order', () => {
    const html = renderToStaticMarkup(
      <Stagger>
        <Reveal>one</Reveal>
        <Reveal>two</Reveal>
      </Stagger>,
    );
    expect(html.indexOf('one')).toBeGreaterThan(-1);
    expect(html.indexOf('two')).toBeGreaterThan(html.indexOf('one'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/motion/Reveal.test.tsx`
Expected: FAIL — `Cannot find module './Reveal'`.

- [ ] **Step 3: Write the implementations**

Create `src/components/ui/motion/Reveal.tsx`:
```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp, motionTokens } from './tokens';

type RevealProps = {
  children: ReactNode;
  className?: string;
  tier?: 'transition' | 'hero';
  delay?: number;
};

/** fadeUp entrance at the given tier. Enter-only: no exit. */
export function Reveal({ children, className, tier = 'transition', delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ ...motionTokens[tier], delay }}
    >
      {children}
    </motion.div>
  );
}

/** Opacity-only entrance for the lightest cases. */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...motionTokens.transition, delay }}
    >
      {children}
    </motion.div>
  );
}
```

Create `src/components/ui/motion/Stagger.tsx`:
```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Staggers the entrance of direct Reveal/FadeIn children. The children use
 * variants ("hidden"/"show"); this parent drives them via staggerChildren.
 */
export function Stagger({
  children,
  className,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/motion/Reveal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/motion/Reveal.tsx src/components/ui/motion/Stagger.tsx src/components/ui/motion/Reveal.test.tsx
git commit -m "feat(motion): add Reveal, FadeIn, Stagger primitives"
```

---

## Task 4: `PageTransition` primitive (enter-only, keyed)

**Files:**
- Create: `src/components/ui/motion/PageTransition.tsx`
- Test: `src/components/ui/motion/PageTransition.test.tsx`

**Interfaces:**
- Produces: `PageTransition(props: { motionKey: string; children: ReactNode; className?: string })` — re-mounts and animates **in** the incoming view when `motionKey` changes. No exit. Consumed by Tasks 10 (wizard steps) and 11 (route enter).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/motion/PageTransition.test.tsx`:
```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageTransition } from './PageTransition';

describe('PageTransition', () => {
  it('renders the current view children', () => {
    const html = renderToStaticMarkup(
      <PageTransition motionKey="/campaigns">view-content</PageTransition>,
    );
    expect(html).toContain('view-content');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/motion/PageTransition.test.tsx`
Expected: FAIL — `Cannot find module './PageTransition'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/motion/PageTransition.tsx`:
```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { motionTokens } from './tokens';

/**
 * Enter-only view transition. Changing `motionKey` re-mounts the inner
 * motion.div (React keys), which replays the entrance. The outgoing view
 * unmounts immediately — there is deliberately no AnimatePresence/exit.
 */
export function PageTransition({
  motionKey,
  children,
  className,
}: {
  motionKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      key={motionKey}
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.transition}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/motion/PageTransition.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/motion/PageTransition.tsx src/components/ui/motion/PageTransition.test.tsx
git commit -m "feat(motion): add enter-only PageTransition primitive"
```

---

## Task 5: `TileReveal` and `MotionNumber` primitives

**Files:**
- Create: `src/components/ui/motion/TileReveal.tsx`
- Create: `src/components/ui/motion/MotionNumber.tsx`
- Test: `src/components/ui/motion/MotionNumber.test.tsx`

**Interfaces:**
- Produces:
  - `TileReveal(props: { children: ReactNode; className?: string })` — hero scale/opacity entrance for a finished tile. Consumed by Task 9.
  - `MotionNumber(props: { value: number; className?: string })` — renders `value.toLocaleString()` and animates the displayed count toward `value` on change. Consumed by Task 7.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/motion/MotionNumber.test.tsx`:
```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MotionNumber } from './MotionNumber';

describe('MotionNumber', () => {
  it('renders the formatted value on first paint (SSR)', () => {
    const html = renderToStaticMarkup(<MotionNumber value={1234} />);
    // Locale-formatted (thousands separator) value present for no-JS/SSR.
    expect(html).toContain('1,234');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/motion/MotionNumber.test.tsx`
Expected: FAIL — `Cannot find module './MotionNumber'`.

- [ ] **Step 3: Write the implementations**

Create `src/components/ui/motion/MotionNumber.tsx`:
```tsx
'use client';

import { animate, useMotionValue, useTransform } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { motionTokens } from './tokens';

/**
 * Animated integer count. SSR/first paint renders the exact formatted value so
 * the number is correct without JS; on subsequent `value` changes the displayed
 * count rolls from the previous value to the new one.
 */
export function MotionNumber({ value, className }: { value: number; className?: string }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const controls = animate(count, value, motionTokens.transition);
    prev.current = value;
    return () => controls.stop();
  }, [value, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
```

Create `src/components/ui/motion/TileReveal.tsx`:
```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { motionTokens, scaleIn } from './tokens';

/** Hero entrance for a finished generation tile. Enter-only. */
export function TileReveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={scaleIn}
      initial="hidden"
      animate="show"
      transition={motionTokens.hero}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/motion/MotionNumber.test.tsx`
Expected: PASS (1 test). (If `renderToStaticMarkup` of the `motion.span` does not include the formatted text because `useTransform` initialises lazily, render the formatted value as the span's initial child text instead — keep the assertion the contract.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/motion/TileReveal.tsx src/components/ui/motion/MotionNumber.tsx src/components/ui/motion/MotionNumber.test.tsx
git commit -m "feat(motion): add TileReveal and MotionNumber primitives"
```

---

## Task 6: Barrel export + global `MotionConfig`

**Files:**
- Create: `src/components/ui/motion/index.ts`
- Modify: `src/components/ui/index.ts`
- Modify: `src/app/layout.tsx:32-34`

**Interfaces:**
- Consumes: all primitives from Tasks 3–5.
- Produces: `@/components/ui` re-exports `FadeIn`, `Reveal`, `Stagger`, `PageTransition`, `TileReveal`, `MotionNumber`, `motionTokens`, `diffArrived`. Global reduced-motion is active app-wide.

- [ ] **Step 1: Create the motion barrel**

Create `src/components/ui/motion/index.ts`:
```ts
export { diffArrived } from './diffArrived';
export { FadeIn, Reveal } from './Reveal';
export { MotionNumber } from './MotionNumber';
export { PageTransition } from './PageTransition';
export { Stagger } from './Stagger';
export { TileReveal } from './TileReveal';
export { fadeUp, motionTokens, scaleIn } from './tokens';
```

- [ ] **Step 2: Re-export from the ui barrel**

Add to the end of `src/components/ui/index.ts`:
```ts
export {
  diffArrived,
  FadeIn,
  MotionNumber,
  motionTokens,
  PageTransition,
  Reveal,
  Stagger,
  TileReveal,
} from './motion';
```

- [ ] **Step 3: Mount `MotionConfig` in the root layout**

In `src/app/layout.tsx`, add the import at the top:
```tsx
import { MotionConfig } from 'motion/react';
```
Replace the body content (`src/app/layout.tsx:32-34`):
```tsx
      <body className="bg-bg-0 text-fg-0 antialiased">
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </body>
```

- [ ] **Step 4: Typecheck and build**

Run: `pnpm typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: build succeeds (root layout compiles; `MotionConfig` is a client component rendered from the RSC layout, which is allowed).

- [ ] **Step 5: Manual reduced-motion smoke check**

Run `pnpm dev`, open the app, enable OS "Reduce motion", reload. Confirm the app renders content immediately (no stuck-hidden elements). Disable it again to confirm animations play. (No automated assertion — node env can't drive RAF.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/motion/index.ts src/components/ui/index.ts src/app/layout.tsx
git commit -m "feat(motion): barrel exports + global reduced-motion MotionConfig"
```

---

# Phase 1 — Core loop

## Task 7: Buzz spend count-roll (`MotionNumber` in `BuzzPill`)

**Files:**
- Modify: `src/components/ui/BuzzPill.tsx:23-28`
- Test: `src/components/ui/BuzzPill.test.tsx` (new)

**Interfaces:**
- Consumes: `MotionNumber` (Task 5).
- Produces: `BuzzPill` renders the amount through `MotionNumber` (animated roll on change) while keeping its props/markup contract.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/BuzzPill.test.tsx`:
```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuzzPill } from './BuzzPill';

describe('BuzzPill', () => {
  it('renders the formatted amount', () => {
    const html = renderToStaticMarkup(<BuzzPill amount={12500} />);
    expect(html).toContain('12,500');
  });

  it('keeps the pill base classes', () => {
    const html = renderToStaticMarkup(<BuzzPill amount={1} />);
    expect(html).toContain('rounded-pill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/ui/BuzzPill.test.tsx`
Expected: FAIL — assertion fails (amount currently rendered by `toLocaleString()` directly is fine, but import path / wiring not yet through MotionNumber — run to capture the baseline, then proceed). If it already passes on `12,500`, continue; the contract is what matters.

- [ ] **Step 3: Wire `MotionNumber`**

In `src/components/ui/BuzzPill.tsx`, add the import:
```tsx
import { MotionNumber } from './motion';
```
Replace the amount render (`src/components/ui/BuzzPill.tsx:23-28`):
```tsx
    <span ref={ref} className={cn(base, sizes[size], className)} {...rest}>
      <BuzzGlyph size={size === 'compact' ? 12 : 14} />
      <MotionNumber value={amount} />
    </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/ui/BuzzPill.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/BuzzPill.tsx src/components/ui/BuzzPill.test.tsx
git commit -m "feat(motion): animate buzz amount roll in BuzzPill"
```

---

## Task 8: Staggered result-grid entrance

Wrap the four result grids so items reveal in sequence on first appearance. Each item must be a `Reveal` (so the `Stagger` parent's variants drive it). Use a stable React key per item and guard re-animation: only the first mount staggers; subsequent poll re-renders re-use the same mounted nodes, so no per-tick replay occurs (React preserves keyed children).

**Files:**
- Modify: `src/components/campaigns/CampaignCreativeGrid.tsx`
- Modify: `src/components/photoshoot/PhotoshootResults.tsx`
- Modify: `src/components/assets/AssetsGallery.tsx`
- Modify: `src/components/catalog/CatalogGrid.tsx`

**Interfaces:**
- Consumes: `Stagger`, `Reveal` (Task 3).

- [ ] **Step 1: Read each grid to find the list-render site**

Run: `pnpm exec rg -n "\.map\(" src/components/campaigns/CampaignCreativeGrid.tsx src/components/photoshoot/PhotoshootResults.tsx src/components/assets/AssetsGallery.tsx src/components/catalog/CatalogGrid.tsx`
Expected: the `.map(...)` that renders the grid items in each file. Note the existing wrapper element/className for the grid container and each item's key.

- [ ] **Step 2: Wrap the grid container and items (per file)**

For each grid, change the container element that holds the mapped items from a plain `<div className={GRID_CLASSES}>` to `<Stagger className={GRID_CLASSES}>`, and wrap each mapped item in `<Reveal key={item.id}>` (move the existing `key` onto `Reveal`). Concretely, the pattern is:

Before:
```tsx
<div className="grid grid-cols-2 gap-3">
  {items.map((it) => (
    <SomeCard key={it.id} {...it} />
  ))}
</div>
```
After:
```tsx
<Stagger className="grid grid-cols-2 gap-3">
  {items.map((it) => (
    <Reveal key={it.id}>
      <SomeCard {...it} />
    </Reveal>
  ))}
</Stagger>
```
Add `import { Reveal, Stagger } from '@/components/ui';` to each file (or extend its existing `@/components/ui` import). Keep the exact grid className and the exact `key` value already in use. Do NOT wrap the live cooking placeholders that update in place — only the resolved item cards (Task 9 handles the cooking→done reveal).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Verify existing component tests still pass**

Run: `pnpm test:unit src/components/campaigns src/components/catalog`
Expected: PASS — existing `CreativeCard`/`PresetGrid`/`ProductDetailGallery` tests unaffected (markup additions wrap, not replace; `data-testid`s preserved).

- [ ] **Step 5: Manual check**

`pnpm dev` → open a campaign with multiple creatives and the assets gallery. Confirm items fade/scale in staggered on load, and that re-renders (navigating away and back, or a poll tick) do NOT replay the stagger for already-present items.

- [ ] **Step 6: Commit**

```bash
git add src/components/campaigns/CampaignCreativeGrid.tsx src/components/photoshoot/PhotoshootResults.tsx src/components/assets/AssetsGallery.tsx src/components/catalog/CatalogGrid.tsx
git commit -m "feat(motion): staggered entrance for result grids"
```

---

## Task 9: Cooking → done tile reveal (with poll guard)

When a polling tile resolves from placeholder to a finished image, play the hero `TileReveal` once. Use `diffArrived` against a `seen` set so the reveal fires exactly once per tile id even though the surface re-renders every poll tick.

**Files:**
- Modify: `src/components/assets/AssetsGallery.tsx` (cooking→done seam; consumes `CookingAssetCard`)
- Modify: `src/components/campaigns/CreativeCard.tsx` (per-image resolved seam)
- Test: extend `src/components/campaigns/CreativeCard.test.tsx`

**Interfaces:**
- Consumes: `TileReveal`, `diffArrived` (Tasks 5, 2).

- [ ] **Step 1: Write the failing test (markup contract)**

Add to `src/components/campaigns/CreativeCard.test.tsx` (inside a new `describe`):
```tsx
describe('CreativeCard — resolved image reveal', () => {
  it('wraps a resolved image in a tile-reveal container', () => {
    const html = render(
      <CreativeCard
        workflowId="wf_done"
        presetId="ig-feed"
        quantity={1}
        // a finished snapshot exposing one url via the mocked extractImageUrls
        initialSnapshot={{ status: 'succeeded', _urls: ['https://img/0.png'] } as never}
      />,
    );
    expect(html).toContain('data-tile-reveal');
  });
});
```
(If `CreativeCard` has no `initialSnapshot` prop, assert against whatever prop seeds a resolved image in the existing test setup — match the existing test's mechanism for a "done" tile. The contract is: a resolved image is wrapped in an element carrying `data-tile-reveal`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/CreativeCard.test.tsx`
Expected: FAIL — `data-tile-reveal` not present.

- [ ] **Step 3: Implement the reveal seam**

In `CreativeCard.tsx`, where a resolved image `<img>` (or its overlay container, the `data-image-overlay` div) is rendered for a slot that just transitioned to "done", wrap that container in `TileReveal` and add the `data-tile-reveal` attribute:
```tsx
<TileReveal className="..."> {/* keep the existing container className */}
  <div data-image-overlay data-tile-reveal>
    {/* existing resolved <img> + overlay */}
  </div>
</TileReveal>
```
Add `import { TileReveal } from '@/components/ui';`. Preserve the existing `data-image-overlay` anchor (workstream K depends on it) and all `data-testid`s.

In `AssetsGallery.tsx`, track arrivals so a finished asset that replaces a `CookingAssetCard` plays the reveal once:
```tsx
import { diffArrived, TileReveal } from '@/components/ui';
import { useRef } from 'react';
// ...
const seen = useRef<Set<string>>(new Set());
const fresh = new Set(diffArrived(seen.current, assets.map((a) => a.id)));
assets.forEach((a) => seen.current.add(a.id));
// when rendering each asset card:
//   fresh.has(asset.id) ? <TileReveal>{card}</TileReveal> : card
```
Render newly-arrived assets inside `TileReveal`; already-seen assets render bare (no re-animation). Keep the existing card markup/testids intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/CreativeCard.test.tsx`
Expected: PASS (existing tests + new reveal test).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Manual poll-guard check**

`pnpm dev` → cook a campaign/photoshoot (MSW or live). Confirm each tile plays the reveal once when it lands, and that tiles already shown do NOT re-animate on subsequent poll ticks.

- [ ] **Step 7: Commit**

```bash
git add src/components/campaigns/CreativeCard.tsx src/components/assets/AssetsGallery.tsx src/components/campaigns/CreativeCard.test.tsx
git commit -m "feat(motion): hero reveal on cooking-to-done tiles with poll guard"
```

---

# Phase 2 — Flow transitions

## Task 10: Wizard step transitions

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx`
- Modify: `src/components/photoshoot/PhotoshootWizard.tsx`
- Modify: `src/app/onboarding/[step]/page.tsx`

**Interfaces:**
- Consumes: `PageTransition` (Task 4).

- [ ] **Step 1: Locate the active-step render in each wizard**

Run: `pnpm exec rg -n "step" src/components/campaigns/CampaignWizard.tsx src/components/photoshoot/PhotoshootWizard.tsx`
Expected: the variable holding the current step id/index and the JSX that renders the active step's body.

- [ ] **Step 2: Wrap the active step body**

Wrap the active step's rendered body in `PageTransition` keyed on the step identifier:
```tsx
<PageTransition motionKey={String(currentStep)}>
  {/* existing active-step body */}
</PageTransition>
```
Add `import { PageTransition } from '@/components/ui';`. Use the wizard's existing current-step value for `motionKey`. For `onboarding/[step]/page.tsx`, key on the `step` route param. Do not change step navigation logic or any form state.

- [ ] **Step 3: Typecheck + existing wizard tests**

Run: `pnpm typecheck && pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx src/components/photoshoot/PhotoshootWizard.test.tsx`
Expected: PASS — wrapping the step body does not change the asserted markup/testids.

- [ ] **Step 4: Manual check**

`pnpm dev` → step through both wizards and onboarding. Confirm each step's content animates in on advance/back; no exit flash.

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/CampaignWizard.tsx src/components/photoshoot/PhotoshootWizard.tsx src/app/onboarding/[step]/page.tsx
git commit -m "feat(motion): enter-only step transitions in wizards and onboarding"
```

---

## Task 11: Route enter transition (app shell)

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `PageTransition` (Task 4).

- [ ] **Step 1: Read the shell layout**

Run: `pnpm exec rg -n "children|Shell|return" src/app/(app)/layout.tsx`
Expected: the JSX node wrapping `children` (the per-route content slot).

- [ ] **Step 2: Wrap `children` keyed on the pathname**

If `(app)/layout.tsx` is a server component, create a thin client wrapper `src/components/shell/RouteTransition.tsx`:
```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageTransition } from '@/components/ui';

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <PageTransition motionKey={pathname}>{children}</PageTransition>;
}
```
Then wrap the content slot in the layout: `<RouteTransition>{children}</RouteTransition>`. Add `import { RouteTransition } from '@/components/shell/RouteTransition';`. Place the wrapper around only the route content slot — not the persistent `Sidebar`/`TopBar`/tab bar (they should not re-animate on navigation).

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Manual check**

`pnpm dev` → navigate between Campaigns / Photoshoot / Brand / Assets. Confirm the content region fades/slides in on each route change while the shell chrome stays put.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/shell/RouteTransition.tsx
git commit -m "feat(motion): route-enter transition for app content slot"
```

---

## Task 12: Onboarding ProcessingStep checklist stagger

**Files:**
- Modify: `src/components/onboarding/ProcessingStep.tsx`

**Interfaces:**
- Consumes: `Stagger`, `Reveal` (Task 3). Keeps the existing CSS orb loops.

- [ ] **Step 1: Locate the checklist render**

Run: `pnpm exec rg -n "checklist|map|items" src/components/onboarding/ProcessingStep.tsx`
Expected: the `.map(...)` rendering the checklist rows.

- [ ] **Step 2: Wrap the checklist in Stagger/Reveal**

Wrap the checklist list container in `<Stagger>` and each row in `<Reveal key={...}>`, mirroring Task 8's pattern. Leave the orb and its CSS-keyframe loops (`pulse-ring`, `dna-rotate`, `scan`, `shimmer`) exactly as-is. Add `import { Reveal, Stagger } from '@/components/ui';`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check**

`pnpm dev` → trigger onboarding processing. Confirm checklist rows reveal in sequence; orb animation unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/ProcessingStep.tsx
git commit -m "feat(motion): stagger onboarding processing checklist"
```

---

# Phase 3 — Entrance / hero

## Task 13: Login screen entrance

**Files:**
- Modify: `src/components/login/LoginScreen.tsx`
- Modify: `src/components/login/AuthCard.tsx` (only if it owns the entrance grouping)

**Interfaces:**
- Consumes: `Stagger`, `Reveal` (Task 3).

- [ ] **Step 1: Read the login composition**

Run: `pnpm exec rg -n "return|Wordmark|AuthCard|LoginPitch" src/components/login/LoginScreen.tsx`
Expected: the JSX grouping the wordmark, pitch, and auth card.

- [ ] **Step 2: Wrap the hero group**

Wrap the top-level login group in `<Stagger gap={0.1}>` and each major block (`Wordmark`, `LoginPitch`, `AuthCard`) in `<Reveal tier="hero">`. Keep the `CivitaiSsoButton` and its `POST /api/auth/login` form behavior untouched — only wrap presentational containers. Add `import { Reveal, Stagger } from '@/components/ui';`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: e2e — auth flow still green**

Run: `pnpm test:e2e tests/00-auth-flow*` (or the auth spec name)
Expected: PASS — wrapping presentational blocks does not change the login button/testids the spec drives.

- [ ] **Step 5: Manual check**

`pnpm dev` (logged out) → confirm the login screen elements reveal in sequence with the hero spring.

- [ ] **Step 6: Commit**

```bash
git add src/components/login/LoginScreen.tsx src/components/login/AuthCard.tsx
git commit -m "feat(motion): hero staggered entrance for login screen"
```

---

# Phase 4 — Micro & nav

## Task 14: Sliding active-nav indicator (`layoutId`)

**Files:**
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/shell/MobileTabBar.tsx`
- Modify: `src/components/ui/TabStrip.tsx`

**Interfaces:**
- Consumes: `motion` (`motion/react`) + `motionTokens` (Task 1). Layout animation only — compatible with enter-only (no exit).

- [ ] **Step 1: Locate the active-state marker in each nav**

Run: `pnpm exec rg -n "active|aria-current|capsule|indicator" src/components/shell/Sidebar.tsx src/components/shell/MobileTabBar.tsx src/components/ui/TabStrip.tsx`
Expected: where the active item's highlight (background/underline/capsule) is rendered.

- [ ] **Step 2: Convert the active highlight to a shared-layout element**

Render the active highlight as a single `motion.div` with a shared `layoutId` per nav, placed only under the active item:
```tsx
import { motion } from 'motion/react';
import { motionTokens } from '@/components/ui';
// inside the active item, behind its content:
{isActive && (
  <motion.div
    layoutId="sidebar-active" // unique per nav: "tabbar-active", "tabstrip-active"
    className="absolute inset-[6px] rounded-[18px] bg-volt/[0.12]" // reuse the existing highlight classes
    transition={motionTokens.feedback}
  />
)}
```
Use the existing highlight classes/metrics already in each component (e.g. `MobileTabBar`'s `inset-[6px] rounded-[18px] bg-volt/[0.12]` capsule). Give each of the three navs a distinct `layoutId`. Preserve `aria-current`, every `data-testid` (`mobile-tab-bar`, `mobile-tab-<label>`), and `min-h-[44px]` touch targets.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: e2e — shell/nav specs still green**

Run: `pnpm test:e2e` (full suite; nav testids are preserved)
Expected: PASS (54 pass, 1 fixme baseline per project memory).

- [ ] **Step 5: Manual check**

`pnpm dev` → click between nav items (desktop sidebar, mobile tab bar, any `TabStrip`). Confirm the highlight slides between items instead of cutting.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/Sidebar.tsx src/components/shell/MobileTabBar.tsx src/components/ui/TabStrip.tsx
git commit -m "feat(motion): sliding shared-layout active indicator in nav"
```

---

## Task 15: Micro-interactions (Button, cards, chips, empty states)

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/campaigns/CreativeCard.tsx` and `src/components/campaigns/PresetGrid.tsx` (hover lift)
- Modify: `src/components/ui/Chip.tsx` and `src/components/campaigns/FilterPills.tsx` (selection feedback)
- Modify: `src/components/assets/AssetsEmptyState.tsx` (entrance)

**Interfaces:**
- Consumes: `motion` + `motionTokens` (Task 1); `FadeIn` (Task 3) for the empty state.

- [ ] **Step 1: Button tap feedback**

In `src/components/ui/Button.tsx`, convert the rendered `<button>` to `motion.button` and add tap/press scale at the `feedback` tier:
```tsx
import { motion } from 'motion/react';
import { motionTokens } from './motion';
// whileTap on the motion.button:
whileTap={{ scale: 0.97 }}
transition={motionTokens.feedback}
```
Keep all existing props/variants/`forwardRef`/`data-testid` behavior. Motion forwards refs for `motion.button`.

- [ ] **Step 2: Card hover lift**

In `CreativeCard.tsx` and `PresetGrid.tsx`, add a `whileHover={{ y: -2 }}` + `transition={motionTokens.feedback}` to the card's outer `motion.div` (convert the existing outer wrapper). Keep classes and `data-testid`s.

- [ ] **Step 3: Chip / FilterPills selection feedback**

In `Chip.tsx` and `FilterPills.tsx`, add `whileTap={{ scale: 0.96 }}` at the `feedback` tier to the interactive element. Selection visual state is already CSS — only add the tap feedback.

- [ ] **Step 4: Empty-state entrance**

Wrap the top content of `AssetsEmptyState.tsx` in `<FadeIn>`. Add `import { FadeIn } from '@/components/ui';`.

- [ ] **Step 5: Typecheck + full unit suite**

Run: `pnpm typecheck && pnpm test:unit`
Expected: no type errors; full unit suite green (per project memory, 545 tests).

- [ ] **Step 6: Manual check**

`pnpm dev` → tap buttons, hover cards, toggle chips/filters, open an empty assets view. Confirm feedback is subtle and fast (≤ ~200ms).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Button.tsx src/components/campaigns/CreativeCard.tsx src/components/campaigns/PresetGrid.tsx src/components/ui/Chip.tsx src/components/campaigns/FilterPills.tsx src/components/assets/AssetsEmptyState.tsx
git commit -m "feat(motion): micro-interactions for buttons, cards, chips, empty states"
```

---

# Final verification

- [ ] **Full typecheck:** `pnpm typecheck` → no errors.
- [ ] **Full unit suite:** `pnpm test:unit` → all green (existing 545 + new motion tests).
- [ ] **Build:** `pnpm build` → succeeds (layout, security headers).
- [ ] **e2e:** `pnpm test:e2e` → baseline green (54 pass, 1 fixme). Because the system is enter-only, no spec needs new `waitFor` for exit delays; confirm no mount-time transform races an assertion.
- [ ] **Reduced motion:** OS "Reduce motion" on → all animations collapse to instant/opacity; content always visible.

## Self-review (spec coverage)

- Spec §Architecture 1 (token layer) → Task 1. ✅
- Spec §Architecture 2 (primitives) → Tasks 3–5. ✅
- Spec §Architecture 3 (global MotionConfig) → Task 6. ✅
- Spec §Architecture 4 (CSS-vs-Motion boundary) → Constraints + Task 12 keeps CSS loops. ✅
- Spec Phase 0 → Tasks 1–6. ✅
- Spec Phase 1 (cooking, grids, buzz) → Tasks 7–9. ✅
- Spec Phase 2 (wizard, route, processing) → Tasks 10–12. ✅
- Spec Phase 3 (login) → Task 13. ✅
- Spec Phase 4 (nav, micro) → Tasks 14–15. ✅
- Spec poll guard → Task 2 helper + Tasks 8/9 usage. ✅
- Spec out-of-scope (exit anims, Modal/BottomSheet/Toast, CSS keyframes migration, anime.js) → respected; no task touches them. ✅
