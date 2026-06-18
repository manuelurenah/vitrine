# Pre-Staging Security & Robustness Audit — `vitrine`

**Date:** 2026-06-18
**Scope:** Full app audit ahead of staging deploy with live Civitai data + live Buzz.
**Method:** 5 parallel domain audits — (1) authN/authZ/IDOR, (2) Buzz/payment/generation, (3) uploads/S3/SSRF, (4) input validation/injection, (5) secrets/headers/infra/DoS.

## TL;DR

The app is **well-built on the fundamentals**: authorization is a disciplined, uniform pattern (every route 401s, derives `userKey`, every data-layer query filters by `userId`). **No IDOR, no SQL injection, no render-XSS, no secret leakage to the client, cookies hardened, no open redirect.**

The exposure is concentrated in three places, all fixable before staging:

1. **SSRF in the website scraper** (`scrape.ts`) — DNS-rebinding TOCTOU + stylesheet redirect bypass can reach cloud metadata / internal hosts.
2. **Asset finalize trusts the client** — `bucket`/`key`/`publicUrl` accepted verbatim → cross-tenant pointers + stored `javascript:`/`data:` URL XSS.
3. **No rate limiting + no server-side Buzz/balance gate** on cook/generate/scrape/login/LLM endpoints — cost & abuse risk with live data. `REDIS_URL` is declared in env but never wired.

Plus audit-trail integrity bugs in the Buzz "charge once" path (non-idempotent under concurrent polls; animate/upscale double-record).

### Go / No-Go recommendation

**Conditional go.** Fix the 🔴 **P0** items below before staging-with-live-data. The 🟠 P1 items should land in the first staging hardening pass. P2 are backlog.

---

## Triage board

> **Implemented 2026-06-18** on branch `fix/security-audit-prestaging` (commits `c32451e`…`ac3aa67`). All P0/P1 + cheap-P2 landed; only the CSP-nonce half of #10 is deferred, and #13/#19 are documented/accepted.

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| 1 | 🔴 P0 | SSRF | DNS-rebinding TOCTOU in `fetchHtml` | ☑ done — pinned-lookup undici dispatcher |
| 2 | 🔴 P0 | SSRF | Stylesheet fetch `redirect:'follow'` bypasses host check | ☑ done — every hop revalidated at connect |
| 3 | 🔴 P0 | Upload/XSS | Asset finalize trusts client `bucket`/`key`/`publicUrl` | ☑ done — `isOwnedStorageKey` + re-derived URL |
| 4 | 🔴 P0 | XSS | `publicUrl` accepts `javascript:`/`data:` → stored XSS in `<a href>` | ☑ done — client `publicUrl` no longer stored |
| 5 | 🔴 P0 | DoS/cost | No rate limiting on cook/generate/scrape/login/LLM | ☑ done — Postgres fixed-window limiter |
| 6 | 🟠 P1 | Payment | Terminal Buzz charge not idempotent under concurrent polls | ☑ done — `recordSubmitChargeOnce` |
| 7 | 🟠 P1 | Payment | Animate/upscale double-record `submit` (charged=0) | ☑ done — inline `submit` dropped |
| 8 | 🟠 P1 | Payment | `buzz_events` has no DB-level idempotency constraint | ☑ done — partial unique index (migration 0012) |
| 9 | 🟠 P1 | Upload | Presigned PUT signs ContentType but **not** ContentLength | ☑ done — Content-Length signed |
| 10 | 🟠 P1 | Headers | CSP allows `unsafe-inline`/`unsafe-eval`; no HSTS | ◐ partial — HSTS added; **CSP nonce deferred** |
| 11 | 🟠 P1 | Info-leak | `err.message`/`err.body` echoed to client (S3, scrape SSRF-oracle, orchestrator) | ☑ done — coarse codes; logged server-side |
| 12 | 🟡 P2 | SSRF | `assetMirror.ts` unguarded fetch + unbounded buffer (latent, no caller) | ☑ done — size cap + SSRF prerequisite documented |
| 13 | 🟡 P2 | Upload | SVG accepted; XSS contained only by separate storage origin | ⊘ documented — invariant recorded in AGENTS.md |
| 14 | 🟡 P2 | Multi-tenant | `getUserKey` `anon` fallback can collapse users (latent) | ☑ done — throws in production |
| 15 | 🟡 P2 | Hardening | `isPrivateIp` omits `100.64.0.0/10` (CGNAT) + benchmark ranges | ☑ done |
| 16 | 🟡 P2 | Enumeration | `403` vs `404` oracle on animate/upscale (others use 404) | ☑ done |
| 17 | 🟡 P2 | DoS | `getObjectAsDataUrl` unbounded base64 into memory (dev path) | ☑ done — 50MB ceiling |
| 18 | 🟡 P2 | Payment | Regenerate `numImages` not re-clamped server-side (theoretical) | ☑ done — clamped to [1,8] |
| 19 | 🟡 P2 | Prompt-inj | User text → LLM prompt (contained: clamped + escaped) | ⊘ accepted — defense-in-depth only |

### Still open after this pass
- **#10 CSP nonce** — `script-src` still has `'unsafe-inline'`/`'unsafe-eval'`. Needs a per-request nonce threaded through middleware + root layout (regression-prone); deferred to a focused follow-up. HSTS is in place.

---

## 🔴 P0 — fix before staging

### 1. SSRF: DNS-rebinding TOCTOU in `fetchHtml`
**`src/lib/scrape.ts:142-168`**

`assertPublicHost(hostname)` resolves DNS and validates, then `fetch(url)` re-resolves the **same hostname independently**. An attacker registers a domain whose DNS returns a public IP on the first lookup and a private IP (e.g. `169.254.169.254`) on the second (low TTL / round-robin). Validated host ≠ fetched host → SSRF to cloud metadata / internal services. Same gap on every redirect hop.

**Fix:** resolve once, pin the IP, connect to the pinned IP while sending the original `Host` header (undici custom `lookup`/dispatcher, or resolve-then-fetch-by-IP). Re-validate the pinned IP — never re-validate the hostname.

### 2. SSRF: stylesheet fetch follows redirects unchecked
**`src/lib/scrape.ts:219-227`**

`fetchOneStylesheet` validates only the initial host, then `fetch(url, { redirect: 'follow' })`. An attacker stylesheet URL 302-redirects to `http://169.254.169.254/...` or `http://10.x` and undici follows with no re-check (blind SSRF: internal GETs, port-scan-by-timing, metadata fetch).

**Fix:** `redirect: 'manual'`, run each hop through `assertPublicHost` (same loop as `fetchHtml`), or pin IPs as in #1.

### 3. Asset finalize trusts client-supplied storage pointer
**`src/app/api/assets/route.ts:54-75` + `src/lib/assets.ts:149-173`**

`presignUpload` guarantees `key = ${userId}/${uuid}.ext`, but the finalize POST reads `bucket`/`key`/`publicUrl` straight from the body and `createAsset` inserts them verbatim — no check that `key` starts with `${userKey}/` or that `publicUrl` points at our storage. A user can register a DB asset row pointing at another user's object (`key:"<victimId>/<uuid>.png"`, gated by guessing the UUID) or at an **arbitrary external URL** (unconditional).

**Fix:** ignore client `bucket`/`key`/`publicUrl`; re-derive from a server-issued presign token. Or enforce `key.startsWith(userKey + '/')`, `bucket ∈ {uploads,assets}`, and `publicUrl === publicUrlFor(bucket, key)`. Reject otherwise.

### 4. Stored XSS via `publicUrl` dangerous schemes
**`src/app/api/assets/route.ts:10` (schema) → `src/components/assets/AssetDetailView.tsx:178-186,379-382` (sink)**

`publicUrl: z.string().url()` accepts `javascript:alert(document.cookie)`, `data:text/html,...`, `vbscript:` (verified). Combined with #3 the value is stored and rendered as `<a href={asset.publicUrl} target="_blank">` on the asset detail "download" buttons. A click executes `javascript:` in the app origin → session-scoped actions / cookie theft. CSP `script-src 'unsafe-inline'` does not block `javascript:` navigations.

**Fix:** constrain schema to http(s): `z.string().url().refine(u => /^https?:/i.test(u))` **and** validate it equals `publicUrlFor(bucket, key)` at finalize. Defense-in-depth: sanitize href at render. (Closing #3 closes most of this, but harden the schema regardless.)

### 5. No rate limiting / no server-side spend gate
**`campaigns/cook`, `assets/generate`, `onboarding/scrape`, `auth/login`, `adCopy.ts`, `photoshootDraft.ts`, regenerate/animate/upscale**

Zero per-user / per-IP throttle anywhere. An authenticated user can loop `cook`/`generate` to drain Buzz + hammer the orchestrator, loop `scrape` to use the server as a request amplifier / blind port-scanner, and burn OpenRouter quota via LLM calls. Spend authorization is **entirely delegated to the Civitai orchestrator** — the app never reads `getBuzzAccount` before spending and has no cap. `REDIS_URL` is in `env.ts:33` but **never imported anywhere**; no rate-limit package in `package.json`.

**Fix:** add per-user + per-IP token-bucket limits on cook/generate/scrape/login (+ regenerate/animate/upscale). Wire the existing `REDIS_URL` to a shared limiter (`lib/rateLimit.ts`), or back it with Postgres. At minimum cap per-user generation concurrency. Document that Buzz balance is orchestrator-enforced and add a pre-flight `getBuzzAccount` check for large fan-outs.

---

## 🟠 P1 — first staging hardening pass

### 6. Terminal Buzz charge is not idempotent under concurrent polls
**`src/app/api/workflow/[id]/route.ts:90-111`**

The "charge once" guard is `previouslyCharged !== charged`, read at request top with no lock/transaction. Two tabs (or a scripted double-poll) both read `chargedBuzz === 0`, both pass, both `recordBuzzEvent({kind:'submit', charged:N})`. `buzz_events` has no unique constraint → duplicate `submit` rows. Doesn't double-spend at Civitai (orchestrator charged once) but **double-counts `sumChargedBuzz`**, rendered to the user as "buzz spent in vitrine" (`settings/page.tsx:38`) — corrupts the audit total.

**Fix:** make it atomic — `UPDATE generations SET charged_buzz=$N WHERE workflow_id=$id AND charged_buzz <> $N RETURNING`, only `recordBuzzEvent` when a row returns. Or add the partial unique index from #8 + `onConflictDoNothing`.

### 7. Animate/upscale double-record `submit` with `charged=0`
**`generations/[workflowId]/images/[index]/animate/route.ts:124-137`, `upscale/route.ts:100-113`**

These routes emit both `estimate` and `submit` inline at submission, with `submit` recorded `charged=0` (estimate only). Their terminal poll then goes through `workflow/[id]` which records a **second** `submit` with the real `charged` → two `submit` rows per op, inconsistent with the cook/regenerate path (which records `submit` only on terminal).

**Fix:** drop the inline `kind:'submit'` write in both routes; keep only the `estimate` event. Let the terminal `workflow/[id]` poll record the single authoritative `submit`.

### 8. `buzz_events` has no idempotency constraint
**`src/lib/db/schema.ts:358-376`**

The "charged once" invariant is enforced only by app logic (which is racy — see #6). No DB backstop.

**Fix:** add `uniqueIndex().on(workflowId, kind).where(sql\`kind = 'submit'\`)` and `onConflictDoNothing` at every `submit` insert. `pnpm db:generate` → review → `pnpm db:migrate` → `pnpm test:db:setup`.

### 9. Presigned PUT signs ContentType but not ContentLength
**`src/lib/s3.ts:60-77`**

The presign binds `Bucket`/`Key`/`ContentType` only. The `byteSize <= 20MB` check in `/api/assets/presign` is never signed into the URL, so within the 600s TTL a client can PUT a multi-GB body → storage fill / egress cost. (ContentType *is* signed, so type-swap is rejected.)

**Fix:** sign a `Content-Length` (or use a POST policy with `content-length-range`) so storage rejects oversized PUTs.

### 10. CSP `unsafe-inline`/`unsafe-eval` + no HSTS
**`next.config.mjs:63,73-79`**

`script-src` allows `'unsafe-inline' 'unsafe-eval'` → any XSS executes freely (the file comment already acknowledges the nonce path). No `Strict-Transport-Security` → TLS-downgrade/MITM can capture `civ_session` on staging.

**Fix:** move to nonce-based CSP (`strict-dynamic` + per-request nonce via middleware), drop `unsafe-inline`/`unsafe-eval` for `script-src`. Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (gate to non-local).

### 11. Internal `err.message` / `err.body` echoed to client
**`assets/presign/route.ts:45`, `assets/route.ts:79`, `onboarding/scrape/route.ts:44,47`, `animate/route.ts:148`, `upscale/route.ts:124`, `campaigns/[id]/export/route.ts:54`, `tiles/[tileId]/download/route.ts:51`**

S3 errors leak endpoint host / bucket / region. **Scrape errors are a blind-SSRF oracle** — `<host> resolves to private IP` / timing lets an attacker map the internal network even though the fetch is blocked. Orchestrator `err.body` leaks internal URLs.

**Fix:** return coarse error codes to the client (`{ error: 'presign_failed' }`, `{ error: 'blocked_host' }`); log specifics server-side only. Gate any `detail` on `NODE_ENV !== 'production'`.

---

## 🟡 P2 — backlog / defense-in-depth

- **12 — `assetMirror.ts:57-67`:** `mirrorOrchestratorImage` fetches `sourceUrl` with no host validation and buffers the full `arrayBuffer()` (memory DoS). **No production caller today** — but guard it (allow-list + streaming byte cap) before any route passes a user-influenced URL in.
- **13 — SVG upload (`s3.ts:40-48`, AssetUploader):** SVG with `<script>` is stored XSS *iff* assets are ever served from the app origin. Contained today because assets serve from a separate `S3_PUBLIC_URL` (`:9000`/R2). **Document "storage origin must stay separate from app origin" as a hard requirement;** optionally set `Content-Disposition: attachment` / `nosniff` on the bucket or rasterize SVGs.
- **14 — `getUserKey` `anon` fallback (`userKey.ts:25`):** if `getMe()` ever returns no `id` AND no `username`, multiple users collapse to `userKey='anon'` and share data. Not reachable with real Civitai tokens today. **Fix:** fail closed (401) instead of returning `'anon'`; gate the single-tenant convenience behind a dev-only flag.
- **15 — `isPrivateIp` (`scrape.ts:84-111`):** omits `100.64.0.0/10` (CGNAT, used by some k8s/cloud internal nets), `192.0.0.0/24`, `198.18.0.0/15`. Add these ranges.
- **16 — `403` vs `404` enumeration (`animate/route.ts:73`, `upscale/route.ts:48`):** foreign-owner returns `403`, non-existent returns `404` → existence oracle. `workflow/[id]` deliberately uses `404` for both. Make these match.
- **17 — `getObjectAsDataUrl` (`s3.ts:160-172`):** unbounded base64 into memory; dev-mode/self-targeted path. Add a size guard once #9 lands.
- **18 — regenerate `numImages` (`regenerateInput.ts:123`):** derives `quantity` from the persisted tile (written only via the bounded cook path), so not directly client-settable — but add an explicit `Math.min(quantity, MAX)` clamp to mirror the cook-path Zod caps.
- **19 — Prompt injection (accepted):** user brief/brand/scraped text concatenated into LLM prompts (`adCopy.ts`, `promptBuilder.ts`). Impact bounded — output is length-clamped + sanitized + React-escaped, no HTML sink, no exfil channel, single-tenant self-service. Defense-in-depth note only.

---

## What was verified SAFE (coverage)

- **AuthZ/IDOR:** all ~38 API routes 401 on null session and pass `userKey` into data-layer helpers; **every** `get/list/update/delete` in `campaigns/photoshoots/catalog/assets/brand/tileVersions/generations/onboarding/account` filters by `userId`. Nested resources (tiles, versions, product images) re-verify parent ownership via joins. RSC pages independently guard — not relying solely on layout. Logout + revoke fully clear session.
- **SQL injection:** zero `sql.raw`/`sql.identifier`/dynamic ORDER BY-LIMIT in the codebase. Every `sql\`\`` `${}` is a parameterized bind or column reference. SQLi surface effectively nil.
- **Render XSS:** only `dangerouslySetInnerHTML` is a static theme no-flash script. No markdown/HTML-parser lib in deps; all user/LLM strings render as escaped JSX.
- **Cost integrity (good parts):** estimate never trusted from client on submit (recomputed server-side every path); workflowId ownership verified before the workflow route acts; cost-driving fields (`variantsPerPreset ≤ 8`, `numImages ≤ 4`, `variantsPerTemplate ≤ 4`, enum aspect/resolution) Zod-capped at cook/estimate; `syncAssetsFromSnapshot` idempotent on `(bucket, storageKey)`.
- **Secrets:** only `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_CIVITAI_BASE_URL` reach the client (both non-secret). No token/secret in client components, responses, or rendered HTML. `.env` gitignored + untracked; `.env.example` has empty placeholders. DB connection string never logged.
- **Headers present:** CSP w/ `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **No CORS exposure, no open redirect** (`redirectHome` builds fixed `new URL('/', req.url)`), **no CSRF-via-GET** (all mutations POST/PATCH/DELETE; only GET state-touch is `workflow/[id]` syncing the user's own ownership-checked workflow). Cookie flags correct (`httpOnly` + `secure`-in-prod + `sameSite=lax`). Health route leaks only status/uptime.
- **scrape.ts baseline (the parts that are solid):** http(s)-only, literal-IP/localhost/`.internal`/`.local` rejected pre-fetch, `lookup({all:true})` checks every A/AAAA record, IPv4-mapped IPv6 recursed, `MAX_BYTES=750KB` streaming cap, 8s timeout, ≤3 redirects. The TOCTOU (#1) and stylesheet redirect (#2) are the gaps in an otherwise good guard.

---

## Suggested sequencing

1. **Before staging (P0):** #3+#4 together (one finalize fix closes both — re-derive storage pointer server-side, http(s)-only schema). #1+#2 (IP-pinning in `scrape.ts`). #5 (`lib/rateLimit.ts` on cook/generate/scrape/login).
2. **First hardening pass (P1):** #8 migration → #6+#7 ride on it. #9 ContentLength. #10 CSP nonce + HSTS. #11 error-message suppression.
3. **Backlog (P2):** #12–#18; document #13/#14 invariants.

> Status legend: ☐ open · ◐ in progress · ☑ done · ⊘ accepted/won't-fix. Update the triage board checkboxes as items land.
</content>
</invoke>
