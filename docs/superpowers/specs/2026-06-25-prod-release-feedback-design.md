# Prod Release Feedback — Design Spec

**Date:** 2026-06-25
**Source:** `2026-06-25-prod-release-feedback.md`
**Status:** Approved (user directive: "just rip it" — implement without further gate)

Eight independent production fixes from release feedback. Each is self-contained;
they share only two files (`globals.css`, `src/app/layout.tsx`) which are
coordinated in the plan to avoid edit conflicts.

---

## 1. Favicon

**Problem:** No favicon anywhere. Browser 404s `/favicon.ico`.

**Source asset:** `public/brand/logomark.svg` — 64×64 chevron "V", linear gradient
`#00ff9d` (volt) → `#19f0ff` (ion).

**Design:**
- Add `src/app/icon.svg` (copy of logomark) — Next.js App Router auto-serves it as
  the favicon with correct `<link>` injection. SVG favicons are supported by all
  current evergreen browsers.
- Add `src/app/apple-icon.png` (180×180 PNG, gradient V on dark `#0a0a0f`
  rounded-square bg) for iOS home-screen. Generated from the SVG via `sharp`
  (already a dependency).
- Add `src/app/icon.png` (32×32 fallback PNG) for the handful of clients that
  ignore SVG favicons.
- No `metadata.icons` hand-wiring needed — file-based convention handles it. Confirm
  no duplicate `<link>` is added manually.

**Acceptance:** `pnpm build` emits icon routes; `curl -I /icon.svg` → 200;
favicon renders in a browser tab.

---

## 2. SEO (bare minimum)

**Problem:** No `robots.txt`, no sitemap, no OpenGraph/Twitter cards, no
`metadataBase`, no per-page descriptions. Most pages are auth-gated and must NOT
be indexed; only the public landing page (`/`) should be.

**Design:**
- **`metadataBase`** in root `layout.tsx` metadata, sourced from
  `env.NEXT_PUBLIC_APP_URL` (already validated in `src/lib/env.ts`). Required for
  OG/relative URL resolution.
- **OpenGraph + Twitter** blocks in root metadata: `title`, `description`,
  `siteName: 'vitrine'`, `type: 'website'`, `images` → an
  `src/app/opengraph-image.tsx` (Next OG image route) OR a static
  `public/brand/og.png`. Use a static `public/brand/og.png` generated with `sharp`
  (V logomark + wordmark + tagline on brand-dark bg) to avoid edge-runtime OG
  complexity. `twitter.card: 'summary_large_image'`.
- **`src/app/robots.ts`** — allow `/`, disallow the auth-gated trees
  (`/campaigns`, `/photoshoot`, `/brand`, `/catalog`, `/assets`, `/settings`,
  `/onboarding`, `/api`). Point `sitemap` at the sitemap route.
- **`src/app/sitemap.ts`** — single entry for `/` (the only public page). Keep it
  honest: do not list gated routes.
- **Per-route `robots` directive:** the auth-gated `(app)/layout.tsx` already runs
  on every gated page — add `metadata.robots = { index: false, follow: false }` at
  the layout level so gated pages emit `<meta name="robots" content="noindex">`
  defensively (in case a URL leaks). The `/onboarding` and login pages: landing `/`
  is indexable; onboarding gets `noindex`.
- Keep existing per-page `title`s. Add a short `description` only to the public
  landing page; gated pages don't need descriptions (they're noindexed).

**Acceptance:** `/robots.txt` and `/sitemap.xml` resolve; landing page has OG tags
in `<head>`; gated pages carry `noindex`; `pnpm build` clean.

---

## 3. Onboarding form validation

**Problem:** User clicks "continue" through the whole flow with empty fields;
`completedAt` is set merely by *navigating to* `/onboarding/next`
(`recordOnboardingStep` sets it on step index, never checks payload). Four skip
paths exist: empty `InputStep.onContinue`, plain `<Link>` on DnaStep, always-visible
"skip →" in `OnboardingFrame`, and unconditional ArrowRight nav.

**Design — gate at two layers (client UX + server truth):**

- **Client (InputStep):** `onContinue` must validate required brand-DNA inputs
  before advancing. Required minimum to proceed: a non-empty **brand name** AND
  (**brand description** non-empty OR a successfully-scraped brand URL). Block with
  inline field errors (match existing `urlError` `useState` + inline `<p>` pattern;
  no new form lib — `zod` is already present, reuse a small schema). Disable/short-
  circuit ArrowRight nav and the "skip →" link when the current step's requirements
  are unmet.
- **DnaStep:** replace the plain `<Link href="/onboarding/next">` with a guarded
  handler that blocks if the brand record lacks the minimum (name + description/
  palette). Drive the readiness bar from the real `computeReadiness()` value
  (currently hardcoded `100%`); require a threshold (e.g. ≥ 60%) to enable "let's
  go".
- **Server (source of truth):** introduce a payload-completeness check. Replace the
  index-only `completedAt` write in `recordOnboardingStep` with a call to the
  existing-but-unused `markOnboardingComplete()` that only sets `completedAt` when
  the persisted brand has the minimum DNA (name + description/colors). If a user
  reaches `/onboarding/next` without sufficient brand DNA, do **not** complete —
  redirect them back to the first incomplete step. This closes every client bypass
  at once.
- **"skip →" link:** remove it (it exists only to bypass data entry — the explicit
  cause of the bug) OR repoint it to a no-op that respects the gate. Decision:
  **remove** the skip link; it directly contradicts the requirement.

**Acceptance:** Clicking continue with empty brand name shows inline error and does
not advance; reaching `/onboarding/next` with no brand DNA does not set
`completedAt` and redirects back; a normal run still completes. Covered by an e2e
update if the onboarding spec asserts completion.

---

## 4. Mobile header/nav light-theme support

**Problem:** Three inline `style={{ background: 'rgba(15,15,22,0.9x)' }}` (and one
dark `boxShadow`) bypass the CSS-variable theme system, so the mobile top bar,
bottom tab pill, and sticky CTA stay dark in light theme.

**Locations:** `MobileTopBar.tsx:56`, `MobileTabBar.tsx:49-54`, `ScreenFrame.tsx:105`.

**Design:**
- Add a theme-aware translucent surface token pair in `globals.css`:
  `--bg-blur` → dark `rgba(15,15,22,0.92)`, light `rgba(250,249,245,0.92)` (matches
  `--bg-0` in each theme). Add a matching `--shadow-float` if the tab-bar shadow
  needs a light variant (reuse existing `--shadow-lg` if it fits).
- Replace the three hardcoded inline backgrounds with `var(--bg-blur)` (keep the
  `backdrop-blur`). Replace `MobileTabBar`'s hardcoded `boxShadow` with the
  theme-aware shadow token.
- Verify against the desktop pattern (`bg-bg-0` / `var(--bg-0)`), which already
  themes correctly.

**Acceptance:** Toggle light theme on a mobile viewport — top bar, tab pill, and
sticky CTA adopt light surfaces; dark theme unchanged. `pnpm typecheck` clean.

---

## 5. Auth random-logout (token refresh)

**Problem (root cause):** `getSession()` both reads and refreshes. When called from
an RSC (every gated page render via `force-dynamic` `(app)/layout.tsx`), a refresh
on expiry calls `oauthRefresh()` then `setSession()`. The cookie write throws in RSC
context ("Cookies can only be modified in a Server Action or Route Handler") and is
**silently swallowed** — so the new tokens are never persisted. If Civitai issues
single-use refresh tokens, the old refresh token is now burned and the next read
fails → `clearSession()` → logout. Concurrent RSC renders racing the same refresh
token compound it. (Hypotheses 1–4 from recon.)

**Design — refresh only where cookies are writable; never burn a token we can't
persist:**

1. **RSC read path must not consume a non-persistable refresh.** In `getSession()`,
   detect when a cookie write is impossible (RSC render) and, on expiry, refresh
   **only if the new tokens can be written**. Concretely: attempt `setSession`; if it
   throws the RSC-cookie error, treat the refresh as not-yet-persisted and avoid
   re-issuing additional burning refreshes. The cleanest implementation: move the
   actual refresh+persist into a dedicated **route handler** and have RSC reads
   tolerate a still-valid-but-near-expiry token without burning it.
2. **`POST /api/auth/refresh` route handler** — the single writable place that calls
   `oauthRefresh()` and re-seals the cookie. Idempotent and **single-flight**
   (dedupe concurrent refreshes within the process so racing requests don't each
   burn the refresh token — e.g. an in-memory promise keyed by session, or a short
   lock).
3. **Preserve `refresh_token` forward.** `OAuthTokens.refresh_token` is optional; if
   a refresh response omits it, carry the previous `refresh_token` into the new
   session instead of dropping it to `undefined` (Hypothesis 3). One-line guard in
   the merge.
4. **Proactive client keep-alive.** Add a small `"use client"` component mounted in
   `(app)/layout.tsx` that calls `POST /api/auth/refresh` (a) on an interval well
   inside the ~1h access-token TTL (e.g. every 10 min), and (b) on
   `visibilitychange`→visible / window focus. This guarantees the persistable
   refresh happens from a route handler, so the cookie actually updates and the RSC
   reads always see a fresh token. Fails silent on network error; never throws into
   render.
5. **Single-flight in `getSession` too** to collapse concurrent in-request refreshes.

This keeps the AGENTS.md rule "don't mutate session in middleware" — we use a route
handler + client pinger, not middleware.

**Acceptance:** Leave the app idle past the access-token TTL (or simulate by
shortening it) → user stays logged in; the refresh endpoint re-seals the cookie;
no logout on navigation; the `00-auth-flow` e2e spec still passes. Add a unit test
for the `refresh_token`-forward-carry merge and the single-flight dedupe.

---

## 6. Speech-to-text mic (PromptComposer)

**Problem:** `handleMicClick` calls `rec.start()` with no permission preflight. On
Chrome, when mic permission state is `"prompt"` (never asked — the common case),
`SpeechRecognition` fires `onerror { error: "not-allowed" }` instead of prompting,
and the code maps that straight to "microphone permission denied — allow mic via the
address-bar icon". So the error shows even when permission is allowed/askable.

**Design:**
- Before starting recognition, request mic access via
  `navigator.mediaDevices.getUserMedia({ audio: true })`. This triggers the real
  browser permission prompt and resolves only on grant. Immediately stop the
  returned tracks (we don't need the stream — Web Speech captures its own); we use
  it solely to obtain/trigger permission. Then call `rec.start()`.
- On `getUserMedia` rejection, distinguish error names:
  `NotAllowedError`/`SecurityError` → genuine denied message; `NotFoundError` → "no
  microphone found"; otherwise a generic voice-input-failed message. Use
  `navigator.permissions.query({ name: 'microphone' })` where available to tailor
  copy (denied vs prompt), but don't hard-depend on it (Safari lacks it).
- Keep the existing Web Speech transcription wiring (`onresult`/`onend`); only the
  permission-acquisition front and error mapping change.
- Guard secure-context / unsupported-API cases with clear, distinct messaging.

**Acceptance:** On a browser with mic allowed (or askable), clicking mic prompts (if
needed) and starts listening — no false "denied". With mic actually blocked, the
denied message shows. Manual verification documented; no e2e (browser mic perms
can't be driven headlessly here).

---

## 7. Keyboard shortcuts (enforce)

**Problem:** Sidebar renders `⌘2` (campaigns) and `⌘3` (photoshoot) hints
(`nav.ts:27-28`, `Sidebar.tsx:53`) but no keydown handler exists. Feedback: enforce
or remove. Decision: **enforce** (better UX, hints already shipped).

**Design:**
- Add a `useNavShortcuts()` hook (mirrors existing `useOnboardingKeyboardNav.ts`
  pattern: `useEffect` + `keydown` + `useRouter().push`). Mount once in `AppShell`
  (covers both desktop and mobile shells; only desktop shows hints but the shortcut
  works everywhere).
- Bind from the nav config so labels and behavior can't drift: iterate `NAV_ITEMS`,
  and when `e.metaKey` (or `e.ctrlKey` on non-Mac) + the item's number is pressed,
  `router.push(item.href)`. Map `⌘2`→`/campaigns`, `⌘3`→`/photoshoot`. Derive the
  key from the shortcut label so adding a hint auto-wires the binding.
- Guard: ignore when focus is in an input/textarea/contenteditable or a modifier
  combo would conflict; `preventDefault` only when we handle it. Don't hijack
  browser-reserved combos beyond the existing `⌘2/⌘3` (those map to tab-switch in
  some browsers — acceptable per existing design choice; scope to the two shown).
- Consider extending the hint+binding to the other primary nav items for
  consistency, but **YAGNI**: implement exactly the two shown unless trivially
  generalizable from the config (it is — so wire whatever items carry a `shortcut`).

**Acceptance:** Pressing `⌘2`/`⌘3` navigates to campaigns/photoshoot from anywhere
in the app shell; typing in a text field does not trigger nav. `pnpm typecheck`
clean.

---

## 8. Green buzz representation

**Problem:** App charges exclusively the **green** pool
(`VITRINE_CURRENCIES = ['green']`, `balance = inner.green`), but 100% of buzz UI is
yellow/amber (`--buzz: #ffce3d`, yellow `BuzzGlyph` gradient, `BuzzPill` yellow).
Users may think they're spending scarce yellow buzz. No "green buzz" copy anywhere.

**Design — recolor to green + label:**
- **Recolor buzz tokens** in `globals.css` to a green pair (align with brand volt
  `#00ff9d` family; pick an accessible green for both themes):
  `--buzz`, `--buzz-soft`, `--buzz-border`, `--buzz-glow` for dark and light. Ensure
  contrast on both `--bg-0` surfaces (run a contrast sanity check; darken the light-
  theme green like the current `#c79900` amber is darkened).
- **`BuzzGlyph.tsx`** gradient stops → green (`#5dffb0`/`#00ff9d`-ish) to match.
- `BuzzPill` and the sidebar balance widget inherit the tokens — no per-component
  color edits needed beyond the token swap; verify nothing hardcodes yellow hex.
- **Copy:** add a clear "green buzz" signal where cost/balance is shown:
  - Sidebar balance widget: label the balance as "green buzz" (or a small "green"
    qualifier + tooltip "Vitrine spends green Buzz from your Civitai wallet — not
    your yellow Buzz.").
  - Cook estimate / total in Campaign + Photoshoot wizards: qualify the cost as
    "green buzz" near the `BuzzPill` total.
  - Keep copy concise; one tooltip source of truth reused.
- Do **not** change charging logic — it already correctly targets green. This is
  purely presentation + copy.

**Acceptance:** Buzz UI renders green in both themes with adequate contrast; balance
and cook-cost surfaces say "green buzz"; a tooltip explains green vs yellow. Visual
check both themes; `pnpm typecheck` clean.

---

## Cross-cutting / shared files

- `src/app/layout.tsx` — touched by **#1 favicon** (none needed if file-based) and
  **#2 SEO** (metadata). Assign both to the same task to avoid conflict.
- `src/app/globals.css` — touched by **#4 mobile theme** (`--bg-blur`) and **#8
  buzz** (recolor). Additive, different blocks; sequence #8 then #4 (or one agent)
  to avoid overlap.
- All other items are file-disjoint and parallelizable.

## Out of scope

- No redesign of onboarding steps beyond the validation gate.
- No new transcription backend (mic stays client-side Web Speech).
- No change to buzz *charging* logic (already green).
- No general auth refactor beyond the refresh-persistence fix.

## Verification matrix

| Item | Command / check |
|---|---|
| 1 favicon | `pnpm build`; icon routes 200; tab favicon |
| 2 SEO | `/robots.txt`, `/sitemap.xml` resolve; OG in `<head>`; gated `noindex`; `pnpm build` |
| 3 validation | `pnpm typecheck`; manual skip attempt blocked; e2e onboarding if affected |
| 4 mobile theme | `pnpm typecheck`; light/dark mobile visual |
| 5 auth | `pnpm typecheck`; refresh unit tests; `pnpm test:e2e` `00-auth-flow`; idle-past-TTL stays logged in |
| 6 mic | `pnpm typecheck`; manual mic grant/deny |
| 7 shortcuts | `pnpm typecheck`; ⌘2/⌘3 navigate; input focus ignored |
| 8 buzz | `pnpm typecheck`; green UI both themes; "green buzz" copy present |
