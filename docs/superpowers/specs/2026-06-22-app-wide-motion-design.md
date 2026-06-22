# App-wide motion system (Motion / `motion/react`) — design

**Date:** 2026-06-22
**Status:** Approved (design)
**Scope:** App-wide UI motion. Adds one dependency (`motion`), a motion-token
layer, a small set of reusable primitives, and an enter-only motion language
applied across the user journey in phases. No backend, schema, or API changes.

## Problem

The app has a strong static design system (dark electric tokens, bloom/glow,
4-pt spacing in `src/app/globals.css`) but motion is ad-hoc: a handful of
hand-rolled CSS `@keyframes` in onboarding (`pulse-ring`, `dna-rotate`,
`shimmer`, `scan`, `dot-pulse`) plus scattered Tailwind `transition` utilities on
hovers and modals. There is no shared motion vocabulary, no consistent entrance
behavior for content, and the moments where users actually wait — cooking a
campaign/photoshoot, watching tiles resolve, spending Buzz — have no orchestrated
feedback. We want a consistent, app-wide motion language that makes the product
feel alive without fatiguing on repeated use.

## Decisions (locked during brainstorming)

- **Goal:** app-wide polish — one consistent motion language, not scattered
  one-offs.
- **Library:** **Motion** (`motion/react`, formerly framer-motion). Declarative,
  React-19-native, tree-shakeable, built-in `prefers-reduced-motion`. Chosen over
  anime.js, which is imperative (manual ref + effect + cleanup per element) and a
  poor fit for an app-wide React system.
- **Intensity:** **tiered** — restrained on repeated/utility surfaces, expressive
  on rare/hero moments (see token tiers).
- **Enter-only:** **no exit animations anywhere.** Outgoing content unmounts
  immediately; only incoming content animates. This removes `AnimatePresence`
  exit orchestration, the Modal/BottomSheet exit-a11y concern, and the e2e
  unmount-delay risk.
- **Reduced motion:** non-negotiable. A single global `MotionConfig
  reducedMotion="user"` makes every Motion component collapse to instant /
  opacity-only with no per-component branching.

## Architecture

Single source of truth for motion, mirroring how `globals.css` is the single
source for color/spacing tokens.

### 1. Motion token layer — `src/components/ui/motion/tokens.ts`

TypeScript constants for the three intensity tiers. Every primitive and surface
pulls durations/easings/springs from here; no inline magic numbers.

- `feedback` — 150–250ms, `ease-out`. Hovers, taps, toggles, selection.
- `transition` — 250–400ms, custom cubic-bezier. Route/wizard/step changes,
  content entrance.
- `hero` — spring (tuned stiffness/damping). Login entrance, result reveal,
  cook-complete tile reveal, Buzz spend.

Shape (illustrative):

```ts
export const motionTokens = {
  feedback: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  hero: { type: 'spring', stiffness: 320, damping: 26 },
} as const

// Shared variants reused by primitives
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
} as const
```

### 2. Reusable primitives — `src/components/ui/motion/`

Thin client components, barrel-exported through the existing
`src/components/ui/index.ts`. Each is enter-only (`initial` → `animate`, no
`exit`).

- `<FadeIn>` / `<Reveal>` — single-element entrance (opacity + small `y`/scale).
- `<Stagger>` — wraps a list/grid; children reveal in sequence via
  `staggerChildren`. Used by result grids and lists.
- `<PageTransition>` — keyed wrapper that re-mounts and animates **in** the
  incoming view on key change (route or wizard step). Enter-only: no
  `AnimatePresence` exit; the outgoing view simply unmounts.
- `<TileReveal>` — cooking placeholder → finished image swap, hero spring + a
  one-shot bloom pulse on arrival.
- `<MotionNumber>` — animated count roll for the Buzz pill.

### 3. Global config — `src/app/layout.tsx`

Mount `<MotionConfig reducedMotion="user">` once at the root, with a default
transition from `motionTokens`. This is the only place reduced-motion is wired;
all primitives inherit it.

### 4. CSS-vs-Motion boundary (explicit, to avoid overlap)

- **Keep in CSS** (`globals.css` `@keyframes`): ambient *loops* — onboarding orb
  `pulse-ring`, `dna-rotate`, `shimmer`, `scan`, `dot-pulse`. Cheaper, no JS,
  already correct. Looping ambient motion is not Motion's job.
- **Use Motion** for: content **entrance**, layout shift (shared-layout nav
  indicator), stagger, gesture/hover lift, and route/step orchestration.

Net new dependency: `motion` (one package, imported as `motion/react`). No
existing CSS animation is removed.

## Components & boundaries

- New: `src/components/ui/motion/` (token file + primitives). Pure presentational
  client components; their only dependency is `motion/react` and the token file.
- Changed: surfaces consume primitives instead of bespoke entrance CSS. Each
  surface keeps its current responsibility; motion is additive.
- Primitives are testable in isolation: given props, they render children with a
  known initial/animate state. Reduced-motion is handled globally, so primitives
  need no per-component branching.

## Rollout (phased, each ships independently)

Tier in brackets. All paths are real files.

### Phase 0 — Foundation (blocks all others)

- Add `motion` dependency.
- Build `ui/motion/tokens.ts`, the primitives, and `<MotionConfig
  reducedMotion="user">` in `app/layout.tsx`. Barrel-export via `ui/index.ts`.
- Verify reduced-motion collapses primitives to instant/opacity-only.

### Phase 1 — Core loop [high impact]

- **Cooking → done:** `src/components/assets/CookingAssetCard.tsx` and the
  placeholder tiles in `CampaignCreativeGrid` / `PhotoshootResults` driven by
  `src/components/campaigns/useTileWorkflow.ts`. Keep CSS shimmer for the *wait*;
  `<TileReveal>` (hero) on image arrival. **Poll guard:** these long-poll and
  re-render every tick — reveals must key off a "newly arrived" flag (e.g. track
  a seen-set of tile ids) so settled tiles do not re-animate on each poll.
- **Result grids:** `CampaignCreativeGrid`, `PhotoshootResults`,
  `AssetsGallery`, `catalog/CatalogGrid` — `<Stagger>` scale/fade-in
  [transition], first appearance only (same poll guard).
- **Buzz spend:** `src/components/ui/BuzzPill.tsx` / `BuzzGlyph.tsx` —
  `<MotionNumber>` count roll + one-shot glow pulse on spend [hero]. Ties to the
  estimate→submit core loop.

### Phase 2 — Flow transitions [medium]

- **Wizard steps:** `CampaignWizard`, `PhotoshootWizard`,
  `app/onboarding/[step]/page.tsx` — `<PageTransition>` enter-only crossfade/slide
  between steps [transition].
- **Route enter:** `src/app/(app)/layout.tsx` shell — `<PageTransition>` keyed on
  `usePathname()`, incoming page fades/slides in [transition]. Enter-only.
- **Onboarding ProcessingStep:** orchestrate the checklist reveal with `<Stagger>`
  while keeping the existing CSS orb loops [transition].

### Phase 3 — Entrance / hero [demo first-impression]

- `src/components/login/` — `LoginScreen`, `AuthCard`, `Wordmark`, `LoginPitch`:
  staggered entrance + wordmark reveal [hero].

### Phase 4 — Micro & nav [low, broad]

- **Nav active indicator:** `shell/Sidebar`, `shell/MobileTabBar`,
  `ui/TabStrip` — sliding active indicator via Motion `layoutId` shared-layout
  [feedback]. (Layout animation, not exit — compatible with enter-only.)
- **Micro:** `ui/Button` tap/bloom, `CreativeCard` / `PresetGrid` hover-lift,
  `Chip` / `FilterPills` selection, empty states subtle entrance [feedback].

## Cross-cutting constraints

- **Client-only:** Motion runs on the client. Primitives are `'use client'`;
  surfaces consuming them are already client components — verify per surface and
  wrap a thin client boundary only where a consumer is currently an RSC.
- **Poll re-render guard:** cooking flows re-render on every long-poll tick.
  Entrance animations must fire once per item (keyed, mount-only), never on each
  poll. This is the single most important correctness rule in the rollout.
- **e2e:** enter-only means the DOM is present immediately and unmounts
  immediately — no exit delay. Motion keeps the element in the DOM and animates
  transforms, so existing `data-testid` selectors and Playwright specs
  (`50-campaigns`, `60-photoshoot`) keep working. Spot-audit after Phase 1 to
  confirm no assertion races a mount-time transform.
- **Bundle:** import from `motion/react` (tree-shakeable); keep primitives thin.

## Verification (per phase)

- `pnpm typecheck` — every phase (touches `src/`).
- `pnpm build` — Phase 0 (touches `app/layout.tsx`).
- Manual reduced-motion check (OS "reduce motion" on → animations collapse to
  instant/opacity).
- `pnpm test:e2e` green — after Phase 1 and at the end.

## Out of scope

- **Exit animations** — explicitly omitted app-wide. Outgoing content unmounts
  immediately.
- **`Modal` / `BottomSheet` / `Toast`** — keep their existing CSS transitions
  untouched (they already include close behavior; no a11y/focus-trap changes).
- **Migrating the existing onboarding CSS `@keyframes`** — they stay as ambient
  CSS loops.
- **anime.js** — not adopted (imperative; poor fit for app-wide React).
- Backend, schema, API, and the Civitai image→video `/animate` route (unrelated
  to UI motion).
- New color/spacing/visual tokens — motion reuses existing bloom/glow/volt
  tokens.
