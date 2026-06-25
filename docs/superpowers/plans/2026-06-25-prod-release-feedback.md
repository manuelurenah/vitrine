# Prod Release Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship eight independent prod-feedback fixes: favicon, minimum SEO, onboarding form validation, mobile light-theme, auth token-refresh persistence, mic permission, nav keyboard shortcuts, and green-buzz representation.

**Architecture:** Next.js 16 App Router, TypeScript strict, React 19, Tailwind 3.4 with CSS-variable theming (`[data-theme="dark|light"]`). Each task is file-disjoint except `src/app/layout.tsx` (favicon+SEO, one task) and `src/app/globals.css` (buzz + mobile theme, sequenced). Tasks run sequentially via subagent-driven-development with a review gate between each.

**Tech Stack:** Next.js 16, `@civitai/app-sdk`, zod, sharp, vitest (unit), Playwright (e2e), lucide-react.

## Global Constraints

- TypeScript strict; every task ends green on `pnpm typecheck`.
- Tailwind colors MUST go through CSS variables (`var(--token)` / `bg-*` classes), never hardcoded hex/rgba inline styles — that is the mobile-theme bug's root cause.
- Never expose `access_token`/`refresh_token`/`CIVITAI_CLIENT_SECRET` to the browser; session stays in the sealed `httpOnly` `civ_session` cookie.
- New env vars require BOTH `src/lib/env.ts` (Zod) AND `.env.example`. (No new env vars are expected in this plan; `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_CIVITAI_BASE_URL` already exist.)
- No new dependencies — `sharp` and `zod` are already installed.
- Unit tests: `pnpm test:unit -- <file>` (vitest; loads `.env` if a test needs it — follow existing test files' setup).
- Commit after each task with a Conventional Commit message, ending:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Civitai buzz: the app charges the **green** pool only (`VITRINE_CURRENCIES = ['green']`). UI must represent green buzz; do NOT change charging logic.

---

### Task 1: Favicon + SEO metadata

**Files:**
- Create: `src/app/icon.svg` (copy of `public/brand/logomark.svg`)
- Create: `src/app/icon.png` (32×32, generated)
- Create: `src/app/apple-icon.png` (180×180, generated)
- Create: `public/brand/og.png` (1200×630 OG image, generated)
- Create: `scripts/gen-icons.mjs` (sharp generator — kept in repo, re-runnable)
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Modify: `src/app/layout.tsx:7-11` (metadata: add `metadataBase`, `openGraph`, `twitter`, `keywords`)
- Modify: `src/app/(app)/layout.tsx` (add `metadata.robots = { index: false, follow: false }`)
- Modify: `src/app/onboarding/[step]/page.tsx` (add `noindex` robots to generateMetadata/metadata)

**Interfaces:**
- Produces: file-based icon routes (`/icon.svg`, `/icon.png`, `/apple-icon.png`), `/robots.txt`, `/sitemap.xml`, and OG/Twitter tags on the public landing page.
- Consumes: `env.NEXT_PUBLIC_APP_URL` (already in `src/lib/env.ts`) for `metadataBase` and absolute URLs.

- [ ] **Step 1: Write the icon generator script**

Create `scripts/gen-icons.mjs`. Reads `public/brand/logomark.svg`, emits PNGs. Use the brand dark bg `#0a0a0f` for raster icons + OG; render the V gradient.

```js
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const logo = await readFile('public/brand/logomark.svg');

// 32x32 PNG favicon (transparent bg, just the V)
await sharp(logo).resize(32, 32).png().toFile('src/app/icon.png');

// 180x180 apple-icon: V centered on rounded brand-dark square
const appleBg = Buffer.from(
  `<svg width="180" height="180"><rect width="180" height="180" rx="40" fill="#0a0a0f"/></svg>`
);
const v = await sharp(logo).resize(120, 120).png().toBuffer();
await sharp(appleBg)
  .composite([{ input: v, gravity: 'center' }])
  .png()
  .toFile('src/app/apple-icon.png');

// 1200x630 OG image: V + "vitrine" wordmark feel on brand-dark
const ogBg = Buffer.from(
  `<svg width="1200" height="630"><rect width="1200" height="630" fill="#0a0a0f"/>` +
    `<text x="600" y="370" font-family="sans-serif" font-size="64" font-weight="700" fill="#ffffff" text-anchor="middle">vitrine</text>` +
    `<text x="600" y="430" font-family="sans-serif" font-size="28" fill="#9a9aa5" text-anchor="middle">your brand, shot on demand.</text></svg>`
);
const vBig = await sharp(logo).resize(180, 180).png().toBuffer();
await sharp(ogBg)
  .composite([{ input: vBig, top: 110, left: 510 }])
  .png()
  .toFile('public/brand/og.png');

console.log('icons + og generated');
```

- [ ] **Step 2: Create `src/app/icon.svg`** — copy `public/brand/logomark.svg` byte-for-byte to `src/app/icon.svg` (`cp public/brand/logomark.svg src/app/icon.svg`).

- [ ] **Step 3: Run the generator**

Run: `node scripts/gen-icons.mjs`
Expected: stdout `icons + og generated`; files `src/app/icon.png`, `src/app/apple-icon.png`, `public/brand/og.png` exist.

- [ ] **Step 4: Update root metadata** in `src/app/layout.tsx`. Replace the existing `metadata` export (lines 7-11) with:

```ts
import { env } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: 'vitrine · campaigns powered by civitai',
  description:
    'drop a photo. ship a campaign. one product shot becomes posts, ads, and a hero video — paid in buzz.',
  keywords: ['ai campaign generator', 'product photoshoot', 'civitai', 'buzz', 'brand marketing'],
  openGraph: {
    type: 'website',
    siteName: 'vitrine',
    title: 'vitrine · campaigns powered by civitai',
    description: 'your brand, shot on demand. on-brand images, ads, and copy — paid in buzz.',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'vitrine' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'vitrine · campaigns powered by civitai',
    description: 'your brand, shot on demand.',
    images: ['/brand/og.png'],
  },
};
```

(Confirm `@/lib/env` import path matches the project's alias; if `env` is already imported in layout, reuse it.)

- [ ] **Step 5: Create `src/app/robots.ts`**

```ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/campaigns', '/photoshoot', '/brand', '/catalog', '/assets', '/settings', '/onboarding', '/api'],
    },
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 6: Create `src/app/sitemap.ts`** (only the public landing page)

```ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: env.NEXT_PUBLIC_APP_URL, changeFrequency: 'weekly', priority: 1 }];
}
```

- [ ] **Step 7: Add defensive `noindex` to gated trees.** In `src/app/(app)/layout.tsx`, add (or merge into existing) a metadata export:

```ts
export const metadata = { robots: { index: false, follow: false } };
```

In `src/app/onboarding/[step]/page.tsx`, ensure the page's metadata (static `metadata` or `generateMetadata`) carries `robots: { index: false, follow: false }`. If a `generateMetadata` exists, add the `robots` field to its return; otherwise add `export const metadata = { robots: { index: false, follow: false } };`.

- [ ] **Step 8: Verify build**

Run: `pnpm typecheck && pnpm build`
Expected: build succeeds; output shows `○ /robots.txt`, `○ /sitemap.xml`, and icon routes. No errors.

- [ ] **Step 9: Commit**

```bash
git add src/app public/brand/og.png scripts/gen-icons.mjs
git commit -m "feat(seo): favicon, OG/twitter metadata, robots + sitemap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Green buzz representation

**Files:**
- Modify: `src/app/globals.css` (buzz token block: dark `:root` ~lines 63-67, light `[data-theme="light"]` ~lines 211-214)
- Modify: `src/components/ui/BuzzGlyph.tsx:16-17` (gradient stops)
- Modify: `src/components/ui/BuzzPill.tsx` (optional `label`/tooltip support — see step 4)
- Modify: `src/components/shell/Sidebar.tsx:88-108` (label balance as green buzz)
- Modify: `src/components/campaigns/CampaignWizard.tsx` (cost area — add "green buzz" qualifier near total, ~line 796)
- Modify: `src/components/photoshoot/PhotoshootWizard.tsx` (cost area — ~line 848)

**Interfaces:**
- Produces: green-themed buzz tokens (`--buzz`, `--buzz-soft`, `--buzz-border`, `--buzz-glow`) consumed by `BuzzPill`, `Sidebar`, `BuzzGlyph`; "green buzz" copy + a single reusable tooltip string.
- Consumes: nothing new.

- [ ] **Step 1: Recolor buzz tokens (dark).** In `src/app/globals.css` `:root`, replace the buzz block:

```css
--buzz: #1fd27a;                          /* green buzz (was #ffce3d yellow) */
--buzz-soft: rgba(31, 210, 122, 0.10);
--buzz-border: rgba(31, 210, 122, 0.28);
--buzz-glow: rgba(31, 210, 122, 0.55);
```

- [ ] **Step 2: Recolor buzz tokens (light).** In the `[data-theme="light"]` block, replace the buzz block with a darker green for contrast on the light `#faf9f5` surface:

```css
--buzz: #0f9d57;                          /* darker green for light-theme contrast */
--buzz-soft: rgba(15, 157, 87, 0.10);
--buzz-border: rgba(15, 157, 87, 0.32);
--buzz-glow: rgba(15, 157, 87, 0.45);
```

- [ ] **Step 3: Recolor the glyph.** In `src/components/ui/BuzzGlyph.tsx` lines 16-17, change the gradient stops to green:

```tsx
<stop offset="0%" stopColor="#5dffb0" />
<stop offset="100%" stopColor="#1fd27a" />
```

- [ ] **Step 4: Add a reusable tooltip + "green buzz" label.** In `src/components/ui/BuzzPill.tsx`, add an optional `title` prop forwarded to the root element so callers can attach the explainer; export a shared constant near the top:

```tsx
export const GREEN_BUZZ_TOOLTIP =
  'Vitrine spends green Buzz from your Civitai wallet — not your scarce yellow Buzz.';
```

Add `title?: string` to BuzzPill's props and spread it onto the root span (`title={title}`). Do not otherwise change BuzzPill layout.

- [ ] **Step 5: Label the sidebar balance.** In `src/components/shell/Sidebar.tsx` balance widget (~lines 88-108), add a small caption under/next to the number reading `green buzz` (use `text-fg-3 text-[10px]` to match existing small captions) and set `title={GREEN_BUZZ_TOOLTIP}` on the balance container. Import `GREEN_BUZZ_TOOLTIP` from `@/components/ui/BuzzPill`.

- [ ] **Step 6: Qualify wizard totals.** In `CampaignWizard.tsx` near the total `BuzzPill` (~line 796) and `PhotoshootWizard.tsx` (~line 848), add an adjacent caption `green buzz` (`text-fg-3 text-[10px]`) and pass `title={GREEN_BUZZ_TOOLTIP}` to the total `BuzzPill`. Keep it to one qualifier per surface — DRY.

- [ ] **Step 7: Confirm no hardcoded yellow remains.**

Run: `grep -rn "ffce3d\|255, *206, *61\|c79900\|text-yellow\|text-amber" src/`
Expected: no buzz-related yellow hits (any remaining hits must be unrelated to buzz; if a buzz component still references yellow, fix it).

- [ ] **Step 8: Verify**

Run: `pnpm typecheck`
Expected: PASS. (Visual: buzz renders green in both themes; "green buzz" copy + tooltip present.)

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/components
git commit -m "feat(buzz): represent spend as green buzz (recolor + copy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Mobile header/nav light-theme support

**Files:**
- Modify: `src/app/globals.css` (add `--bg-blur` token pair; add `--shadow-float` if needed)
- Modify: `src/components/shell/MobileTopBar.tsx:56`
- Modify: `src/components/shell/MobileTabBar.tsx:49-54`
- Modify: `src/components/shell/ScreenFrame.tsx:105`

**Interfaces:**
- Produces: theme-aware `var(--bg-blur)` and `var(--shadow-float)` surfaces replacing the three hardcoded dark `rgba(15,15,22,0.9x)` inline styles.
- Consumes: nothing new.

- [ ] **Step 1: Add the token pair.** In `src/app/globals.css` `:root` (dark), add near the other `--bg-*` tokens:

```css
--bg-blur: rgba(15, 15, 22, 0.92);        /* translucent surface for blurred mobile bars */
--shadow-float: 0 8px 32px -8px rgba(0, 0, 0, 0.6);
```

In `[data-theme="light"]`, add the light counterparts:

```css
--bg-blur: rgba(250, 249, 245, 0.92);     /* matches light --bg-0 */
--shadow-float: 0 8px 32px -8px rgba(10, 10, 30, 0.14);
```

- [ ] **Step 2: Fix MobileTopBar.** In `src/components/shell/MobileTopBar.tsx:56`, replace:

```tsx
style={transparent ? undefined : { background: 'rgba(15,15,22,0.92)' }}
```

with:

```tsx
style={transparent ? undefined : { background: 'var(--bg-blur)' }}
```

- [ ] **Step 3: Fix MobileTabBar.** In `src/components/shell/MobileTabBar.tsx:49-54`, replace the `background` and `boxShadow` lines:

```tsx
background: 'var(--bg-blur)',
boxShadow: 'var(--shadow-float)',
```

(Keep `height`, `bottom`, and any other style keys unchanged.)

- [ ] **Step 4: Fix ScreenFrame.** In `src/components/shell/ScreenFrame.tsx:105`, replace:

```tsx
background: 'rgba(15,15,22,0.92)',
```

with:

```tsx
background: 'var(--bg-blur)',
```

- [ ] **Step 5: Verify no hardcoded mobile-bar darks remain.**

Run: `grep -rn "rgba(15,15,22\|rgba(15, 15, 22" src/components/shell/`
Expected: no hits.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck`
Expected: PASS. (Visual: in light theme on a mobile viewport, top bar / tab pill / sticky CTA use light surfaces; dark theme unchanged.)

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/components/shell
git commit -m "fix(mobile): theme-aware backgrounds for header/nav bars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Onboarding form validation

**Files:**
- Create: `src/lib/onboardingValidation.ts` (pure brand-DNA sufficiency check + zod)
- Test: `src/lib/onboardingValidation.test.ts`
- Modify: `src/lib/onboarding.ts:78-88` (`recordOnboardingStep` — gate `completedAt`) and use of `markOnboardingComplete` (lines ~111-123)
- Modify: `src/app/onboarding/[step]/page.tsx` (redirect back from `next` when DNA insufficient)
- Modify: `src/components/onboarding/InputStep.tsx:144-150` (`onContinue` required-field guard)
- Modify: `src/components/onboarding/DnaStep.tsx:285,287-294` (drive readiness bar from real value; gate "let's go")
- Modify: `src/components/onboarding/OnboardingFrame.tsx:63-67` (remove the "skip →" link)
- Modify: `src/components/onboarding/useOnboardingKeyboardNav.ts:35-37` (don't ArrowRight past an incomplete step)

**Interfaces:**
- Produces:
  - `isBrandDnaSufficient(brand: { name?: string | null; description?: string | null; colors?: unknown }): boolean` — true when brand has a non-default name AND (description non-empty OR ≥1 color).
  - `INPUT_STEP_MIN` zod schema for the input-step required fields.
- Consumes: the brand record shape from `src/lib/brand.ts` and onboarding payload from `src/lib/onboarding.ts`.

- [ ] **Step 1: Write the failing test** for the sufficiency check. Create `src/lib/onboardingValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isBrandDnaSufficient } from './onboardingValidation';

describe('isBrandDnaSufficient', () => {
  it('false for empty brand', () => {
    expect(isBrandDnaSufficient({ name: '', description: '', colors: [] })).toBe(false);
  });
  it('false for fallback default name only', () => {
    expect(isBrandDnaSufficient({ name: 'my brand', description: '', colors: [] })).toBe(false);
  });
  it('true with real name + description', () => {
    expect(isBrandDnaSufficient({ name: 'Acme', description: 'we sell widgets', colors: [] })).toBe(true);
  });
  it('true with real name + at least one color', () => {
    expect(isBrandDnaSufficient({ name: 'Acme', description: '', colors: ['#ff0000'] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- src/lib/onboardingValidation.test.ts`
Expected: FAIL — cannot find module `./onboardingValidation`.

- [ ] **Step 3: Implement `src/lib/onboardingValidation.ts`**

```ts
import { z } from 'zod';

const DEFAULT_BRAND_NAME = 'my brand';

export function isBrandDnaSufficient(brand: {
  name?: string | null;
  description?: string | null;
  colors?: unknown;
}): boolean {
  const name = (brand.name ?? '').trim();
  const hasName = name.length > 0 && name.toLowerCase() !== DEFAULT_BRAND_NAME;
  if (!hasName) return false;
  const hasDescription = (brand.description ?? '').trim().length > 0;
  const hasColor = Array.isArray(brand.colors) && brand.colors.length > 0;
  return hasDescription || hasColor;
}

/** Required fields to advance past the onboarding input step. */
export const INPUT_STEP_MIN = z.object({
  brandName: z.string().trim().min(1, 'add your brand name'),
  description: z.string().trim().min(1).optional(),
  url: z.string().trim().url().optional(),
});

/** True when the input step has the minimum to proceed: a name plus a description or a URL to scrape. */
export function canLeaveInputStep(input: {
  brandName?: string | null;
  description?: string | null;
  url?: string | null;
}): boolean {
  const name = (input.brandName ?? '').trim();
  if (name.length === 0) return false;
  const hasDescription = (input.description ?? '').trim().length > 0;
  const hasUrl = (input.url ?? '').trim().length > 0;
  return hasDescription || hasUrl;
}
```

(Confirm the actual brand field names by reading `src/lib/brand.ts`; adjust `colors` access to the real column — e.g. `palette`. If the brand stores colors under `palette`, rename the param usage accordingly and update the test.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- src/lib/onboardingValidation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Gate server-side completion.** In `src/lib/onboarding.ts`, change `recordOnboardingStep` so that when the visited step is the final `'next'` step, it sets `completedAt` ONLY if the user's brand passes `isBrandDnaSufficient`. Read the brand via the existing brand helper (`getBrand`/`ensureDefaultBrand` from `src/lib/brand.ts`) inside the function (it already has the userKey). If insufficient, do NOT set `completedAt` (leave it null). Pseudocode to adapt to the real query:

```ts
import { isBrandDnaSufficient } from './onboardingValidation';
// ...
const isFinal = step === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
let complete = false;
if (isFinal) {
  const brand = await getBrandForUser(userKey); // use the real helper
  complete = isBrandDnaSufficient(brand ?? {});
}
// set completedAt: complete ? new Date() : keep existing (sql`${...completedAt}`)
```

- [ ] **Step 6: Redirect back when reaching `next` without DNA.** In `src/app/onboarding/[step]/page.tsx`, after `recordOnboardingStep`, if the step is `'next'` and the resulting onboarding state still has `completedAt == null`, `redirect('/onboarding/input')` (import `redirect` from `next/navigation`). This closes ALL client bypasses at the server boundary.

- [ ] **Step 7: Client guard on InputStep.** In `src/components/onboarding/InputStep.tsx` `onContinue` (lines 144-150), before `flushPatch()`, validate with `canLeaveInputStep({ brandName, description, url })` from `@/lib/onboardingValidation`. If false, set an inline error (reuse the existing error `useState` pattern; show `add your brand name` / `add a description or a site to scrape`) and `return` without navigating. Disable the continue button when the brand name field is empty.

- [ ] **Step 8: Fix DnaStep readiness + gate.** In `src/components/onboarding/DnaStep.tsx`:
  - Replace the hardcoded `100%` (line 285) with the real `computeReadiness()` result already computed in the component.
  - Replace the plain `<Link href="/onboarding/next">` (lines 287-294) with a `<Button>` that is `disabled` when readiness is below a threshold (e.g. `< 60`) and otherwise calls `router.push('/onboarding/next')`. Keep the visual styling.

- [ ] **Step 9: Remove the skip link.** In `src/components/onboarding/OnboardingFrame.tsx`, delete the `<Link href={skipHref}>skip →</Link>` (lines 63-67) and the now-unused `skipHref` prop/var. Update any caller passing `skipHref`.

- [ ] **Step 10: Guard ArrowRight nav.** In `src/components/onboarding/useOnboardingKeyboardNav.ts:35-37`, do not advance on ArrowRight from the `input` step unless `canLeaveInputStep` passes. The hook needs access to the current input values — pass a `canAdvance: () => boolean` callback into the hook from the step component and check it before navigating forward. (If the hook is generic, gate only the forward direction.)

- [ ] **Step 11: Verify**

Run: `pnpm typecheck && pnpm test:unit -- src/lib/onboardingValidation.test.ts`
Expected: typecheck PASS; tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/onboardingValidation.ts src/lib/onboardingValidation.test.ts src/lib/onboarding.ts src/app/onboarding src/components/onboarding
git commit -m "fix(onboarding): enforce brand-dna validation, close skip bypasses

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Auth token-refresh persistence (random logout)

**Files:**
- Modify: `src/lib/session.ts` (extract a testable `refreshSession`, forward-carry `refresh_token`, single-flight)
- Create: `src/lib/session.test.ts`
- Create: `src/app/api/auth/refresh/route.ts` (writable refresh endpoint)
- Create: `src/components/shell/SessionKeepAlive.tsx` (client pinger)
- Modify: `src/app/(app)/layout.tsx` (mount `SessionKeepAlive`)

**Interfaces:**
- Produces:
  - `mergeRefreshedTokens(prev: OAuthTokens, fresh: OAuthTokens): OAuthTokens` — returns `fresh` but carries `prev.refresh_token` forward when `fresh.refresh_token` is missing.
  - `POST /api/auth/refresh` → `{ ok: boolean }`, re-seals `civ_session` when a refresh occurs (or is near expiry).
  - `<SessionKeepAlive />` client component.
- Consumes: `getSession`, `setSession`, `clearSession`, `oauthRefresh`, `env`.

**Root cause (from spec §5):** `getSession()` refreshes in RSC render context where `cookies().set()` throws and is silently swallowed, so refreshed tokens never persist; single-use refresh tokens then get burned across renders → logout. Fix: carry `refresh_token` forward, dedupe concurrent refreshes (single-flight), and drive the *persistable* refresh from a route handler pinged by a client keep-alive.

- [ ] **Step 1: Write the failing test.** Create `src/lib/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeRefreshedTokens } from './session';

describe('mergeRefreshedTokens', () => {
  it('keeps the fresh refresh_token when present', () => {
    const out = mergeRefreshedTokens(
      { access_token: 'old', refresh_token: 'oldR', expires_at: 1 } as any,
      { access_token: 'new', refresh_token: 'newR', expires_at: 2 } as any,
    );
    expect(out.refresh_token).toBe('newR');
    expect(out.access_token).toBe('new');
  });
  it('carries the previous refresh_token forward when the refresh omits it', () => {
    const out = mergeRefreshedTokens(
      { access_token: 'old', refresh_token: 'oldR', expires_at: 1 } as any,
      { access_token: 'new', expires_at: 2 } as any,
    );
    expect(out.refresh_token).toBe('oldR');
    expect(out.access_token).toBe('new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- src/lib/session.test.ts`
Expected: FAIL — `mergeRefreshedTokens` not exported.

- [ ] **Step 3: Implement `mergeRefreshedTokens` + use it in `getSession`.** In `src/lib/session.ts`, add and export:

```ts
export function mergeRefreshedTokens(prev: OAuthTokens, fresh: OAuthTokens): OAuthTokens {
  return { ...fresh, refresh_token: fresh.refresh_token ?? prev.refresh_token };
}
```

Replace `const next: Session = { ...session, tokens: fresh };` (line 64) with:

```ts
const next: Session = { ...session, tokens: mergeRefreshedTokens(session.tokens, fresh) };
```

- [ ] **Step 4: Add single-flight dedupe** to avoid concurrent refreshes burning the token. In `src/lib/session.ts`, wrap the refresh in a module-level in-flight map keyed by the refresh token:

```ts
const inflight = new Map<string, Promise<Session | null>>();

async function refreshAndPersist(session: Session): Promise<Session | null> {
  const key = session.tokens.refresh_token!;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const fresh = await oauthRefresh({
        baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL,
        clientId: env.CIVITAI_CLIENT_ID,
        clientSecret: env.CIVITAI_CLIENT_SECRET,
        refreshToken: key,
      });
      const next: Session = { ...session, tokens: mergeRefreshedTokens(session.tokens, fresh) };
      await setSession(next);
      return next;
    } catch {
      await clearSession();
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
```

Then in `getSession`, replace the inline refresh block (lines 57-70) with `return refreshAndPersist(session);` (after the `if (!session.tokens.refresh_token) return null;` guard).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test:unit -- src/lib/session.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Create the writable refresh route.** Create `src/app/api/auth/refresh/route.ts`. It runs in a Route Handler (cookies writable), so `getSession()`'s `setSession` succeeds and the cookie is actually re-sealed:

```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// Re-seals the session cookie if the access token needs refreshing.
// getSession() performs the refresh; in a route handler the cookie write persists.
export async function POST() {
  const session = await getSession();
  return NextResponse.json({ ok: session != null });
}
```

(If `getSession` only refreshes when within 30s of expiry, that is fine — the keep-alive interval is well inside the TTL and the next-due refresh will land here. Verify against `session.ts` logic; the goal is that *some* route-handler call re-seals before RSC reads see expiry.)

- [ ] **Step 7: Create the client keep-alive.** Create `src/components/shell/SessionKeepAlive.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

const INTERVAL_MS = 10 * 60 * 1000; // 10 min, well inside the ~1h access-token TTL

async function ping() {
  try {
    await fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' });
  } catch {
    // network hiccup — ignore; next tick retries
  }
}

export function SessionKeepAlive() {
  useEffect(() => {
    const id = setInterval(ping, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ping);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ping);
    };
  }, []);
  return null;
}
```

- [ ] **Step 8: Mount it.** In `src/app/(app)/layout.tsx`, import and render `<SessionKeepAlive />` inside the layout's returned tree (it renders nothing; place it once near the root of the gated shell).

- [ ] **Step 9: Verify**

Run: `pnpm typecheck && pnpm test:unit -- src/lib/session.test.ts`
Expected: typecheck PASS; tests PASS.

- [ ] **Step 10: e2e auth regression**

Run: `pnpm test:e2e -- 00-auth-flow` (requires the dev Civitai server per AGENTS.md; if the harness is unavailable in this environment, note it and rely on typecheck + unit).
Expected: auth-flow spec PASS (or documented-skipped if harness unavailable).

- [ ] **Step 11: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts src/app/api/auth/refresh src/components/shell/SessionKeepAlive.tsx src/app/\(app\)/layout.tsx
git commit -m "fix(auth): persist token refresh via route handler + keep-alive

Carry refresh_token forward, single-flight refreshes, and drive the
persistable refresh from a writable route handler pinged by a client
keep-alive — fixes random logouts caused by RSC cookie-write swallowing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mic permission (speech-to-text)

**Files:**
- Modify: `src/components/campaigns/PromptComposer.tsx` (`handleMicClick` lines ~115-165, `describeSpeechError` ~42-57)

**Interfaces:**
- Produces: a mic flow that triggers the real browser permission prompt via `getUserMedia` before starting `SpeechRecognition`, and distinct error copy for denied vs no-device vs unsupported.
- Consumes: nothing new.

**Root cause (from spec §6):** `rec.start()` is called with no permission preflight; Chrome fires `onerror{not-allowed}` when permission state is `"prompt"` (never asked), which the code maps to "permission denied". Trigger the prompt explicitly with `getUserMedia` first.

- [ ] **Step 1: Add a permission preflight in `handleMicClick`.** Before `new SR()` / `rec.start()`, request and immediately release a mic stream to trigger the browser prompt and confirm access:

```tsx
async function ensureMicPermission(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: 'voice input is not supported in this browser' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We don't need the stream itself — SpeechRecognition captures its own.
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { ok: false, message: 'microphone permission denied — allow mic for this site via the address-bar icon' };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, message: 'no microphone found' };
    }
    return { ok: false, message: 'could not access the microphone — try again' };
  }
}
```

- [ ] **Step 2: Gate `rec.start()` on the preflight.** Make `handleMicClick` `async`; at its start (after the support check), call:

```tsx
const perm = await ensureMicPermission();
if (!perm.ok) {
  setMicError(perm.message);
  return;
}
```

Then proceed to construct `SR`, wire handlers, and `rec.start()` as before. Keep the existing `onresult`/`onend` wiring untouched.

- [ ] **Step 3: Soften the SpeechRecognition `not-allowed` mapping.** In `describeSpeechError`, since real permission is now verified up front, change the `'not-allowed'` branch copy to acknowledge the transient case (so a late `onerror` after a granted preflight isn't misleading):

```tsx
case 'not-allowed':
  return 'microphone access was blocked — check the site permission in the address-bar icon';
```

(Other branches unchanged.)

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: PASS. (Manual: with mic allowed/askable, clicking mic prompts then listens — no false denial; with mic blocked, the denied message shows.)

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/PromptComposer.tsx
git commit -m "fix(mic): preflight getUserMedia so speech-to-text prompts correctly

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Enforce nav keyboard shortcuts

**Files:**
- Create: `src/components/shell/useNavShortcuts.ts`
- Test: `src/components/shell/useNavShortcuts.test.ts` (pure key-parse helper)
- Modify: `src/components/shell/nav.ts` (export a parse helper mapping shortcut label → digit)
- Modify: `src/components/shell/AppShell.tsx` (mount the hook once)

**Interfaces:**
- Produces:
  - `shortcutDigit(label: string): number | null` — `'⌘2' → 2`, `'⌘3' → 3`, else null (in `nav.ts`).
  - `useNavShortcuts()` — binds `meta/ctrl + <digit>` to `router.push(item.href)` for any NAV item carrying a `shortcut`.
- Consumes: `NAV` from `nav.ts`, `useRouter` from `next/navigation`.

- [ ] **Step 1: Write the failing test.** Create `src/components/shell/useNavShortcuts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shortcutDigit } from './nav';

describe('shortcutDigit', () => {
  it('parses the meta digit', () => {
    expect(shortcutDigit('⌘2')).toBe(2);
    expect(shortcutDigit('⌘3')).toBe(3);
  });
  it('returns null for labels without a trailing digit', () => {
    expect(shortcutDigit('⌘')).toBeNull();
    expect(shortcutDigit('')).toBeNull();
    expect(shortcutDigit(undefined as unknown as string)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- src/components/shell/useNavShortcuts.test.ts`
Expected: FAIL — `shortcutDigit` not exported.

- [ ] **Step 3: Implement `shortcutDigit` in `nav.ts`**

```ts
/** Extract the digit from a shortcut label like '⌘2' → 2. */
export function shortcutDigit(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d)\s*$/);
  return m ? Number(m[1]) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- src/components/shell/useNavShortcuts.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the hook.** Create `src/components/shell/useNavShortcuts.ts`:

```ts
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NAV, shortcutDigit } from './nav';

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useNavShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const bindings = NAV.filter((i) => shortcutDigit(i.shortcut) != null).map((i) => ({
      digit: shortcutDigit(i.shortcut)!,
      href: i.href,
    }));
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;
      const digit = Number(e.key);
      if (Number.isNaN(digit)) return;
      const hit = bindings.find((b) => b.digit === digit);
      if (!hit) return;
      e.preventDefault();
      router.push(hit.href);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}
```

- [ ] **Step 6: Mount the hook.** In `src/components/shell/AppShell.tsx` (the `"use client"` responsive shell), call `useNavShortcuts()` once at the top of the component body. If `AppShell` is not a client component, mount the hook in the nearest client shell wrapper instead (do not convert a server component to client just for this — add a tiny client mounter if needed).

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm test:unit -- src/components/shell/useNavShortcuts.test.ts`
Expected: typecheck PASS; tests PASS. (Manual: ⌘2 → /campaigns, ⌘3 → /photoshoot; typing in a prompt field does not navigate.)

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/nav.ts src/components/shell/useNavShortcuts.ts src/components/shell/useNavShortcuts.test.ts src/components/shell/AppShell.tsx
git commit -m "feat(nav): enforce cmd+2 / cmd+3 navigation shortcuts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `pnpm typecheck` — clean
- [ ] `pnpm test:unit` — all green (existing + new specs)
- [ ] `pnpm build` — clean (icons, robots, sitemap, security headers)
- [ ] `pnpm lint` — no new errors
- [ ] Spot-check: favicon in tab, `/robots.txt` + `/sitemap.xml`, light-theme mobile bars, green buzz copy, ⌘2/⌘3 nav.

## Self-review notes (coverage map)

| Spec § | Task |
|---|---|
| 1 favicon | Task 1 |
| 2 SEO | Task 1 |
| 3 onboarding validation | Task 4 |
| 4 mobile theme | Task 3 |
| 5 auth refresh | Task 5 |
| 6 mic | Task 6 |
| 7 shortcuts | Task 7 |
| 8 green buzz | Task 2 |
