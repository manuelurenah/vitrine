# Security Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — steps use `- [ ]` tracking. Source spec: `claudedocs/security-audit-2026-06-18.md`.

**Goal:** Close the P0/P1 + cheap-P2 findings from the pre-staging security audit.

**Architecture:** Edits stay inside existing patterns — route-level guards, `lib/` helpers, one Drizzle migration, one new dependency (`undici`) for SSRF-safe fetch, one new `lib/rateLimit.ts` backed by Postgres.

**Tech Stack:** Next 16 App Router, Drizzle/Postgres, zod, undici, sharp, vitest.

## Global Constraints

- TypeScript strict — `pnpm typecheck` must pass.
- Tests colocate as `src/**/*.test.ts` (project convention) — run `pnpm test:unit`.
- Schema change → `pnpm db:generate` → review SQL → `pnpm db:migrate` → `pnpm test:db:setup`.
- New env var → add to `src/lib/env.ts` Zod schema **and** `.env.example`.
- Commit per task with a descriptive message.
- Branch: `fix/security-audit-prestaging` (already created).

---

### Task 1: Asset finalize ownership + URL re-derivation (#3, #4)

**Files:** Modify `src/app/api/assets/route.ts`; use `publicUrlFor`/`bucketFor` from `src/lib/s3.ts`. Test: `src/app/api/assets/finalize.test.ts` (pure validator extracted).

- Extract pure `assertOwnedStorageKey(userKey, bucket, key)` + re-derive `publicUrl = publicUrlFor(bucket, key)` server-side; **ignore client `publicUrl`**.
- Reject unless `bucket ∈ {bucketFor('upload'), bucketFor('asset')}` AND `key` starts with `${userKey}/` (uploads) or `generated/${userKey}/` (mirrored).
- Tests: foreign-prefix key → reject; arbitrary bucket → reject; own key → ok + derived publicUrl.

### Task 2: Buzz charge idempotency (#6, #7, #8) + animate/upscale (#16)

**Files:** `src/lib/db/schema.ts` (partial unique index), migration, `src/lib/buzz.ts` (`recordSubmitChargeOnce`), `src/app/api/workflow/[id]/route.ts`, animate + upscale routes. Test: `src/lib/buzz.idempotency.test.ts`.

- Partial unique index `buzz_events_submit_once` on `(workflow_id) WHERE kind = 'submit'`.
- `recordSubmitChargeOnce(input)` → insert kind=`submit` with `onConflictDoNothing({ target: workflowId, targetWhere: eq(kind,'submit') })`; returns inserted-or-not.
- Workflow route: replace `previouslyCharged !== charged` dedup with `recordSubmitChargeOnce` (constraint enforces once).
- animate + upscale: **remove inline `kind:'submit'`** event (keep `estimate`); flip ownership `403 → 404`.

### Task 3: SSRF pinned-lookup fetch (#1, #2) + IP ranges (#15)

**Files:** add `undici` dep; `src/lib/scrape.ts`. Test: `src/lib/scrape.test.ts` (extend `isPrivateIp`).

- `isPrivateIp`: add `100.64.0.0/10` (CGNAT), `192.0.0.0/24`, `198.18.0.0/15`.
- `safeAgent()` → undici `Agent({ connect: { lookup } })` where `lookup` resolves, validates every address via `isPrivateIp`, and returns only public IPs (callback-err on private). Pass `dispatcher: safeAgent()` to `undiciFetch` in `fetchHtml` + `fetchOneStylesheet`. Stylesheet keeps following redirects safely (every hop revalidated at connect).

### Task 4: Presigned PUT ContentLength (#9)

**Files:** `src/lib/s3.ts` (`presignUpload` accepts `contentLength`, signs it), `src/app/api/assets/presign/route.ts` (pass `byteSize`).

### Task 5: Suppress internal error echoes (#11)

**Files:** assets/presign, assets POST, onboarding/scrape, animate, upscale, campaigns export, tile download. Return coarse error codes; `console.error` server-side only.

### Task 6: HSTS header (#10 partial; CSP-nonce deferred)

**Files:** `next.config.mjs` — add `Strict-Transport-Security`. CSP nonce flagged as follow-up (needs middleware; regression risk) — documented, not done here.

### Task 7: Rate limiting (#5)

**Files:** new `src/lib/rateLimit.ts` (Postgres fixed-window), schema table `rate_limits` + migration, wire into cook / assets-generate / onboarding-scrape / auth-login / regenerate / animate / upscale → 429 on exceed. Test: `src/lib/rateLimit.test.ts`.

### Task 8: Cheap hardening (#12, #14, #17, #18)

- #18 `regenerateInput.ts`: clamp `numImages = Math.min(quantity, MAX_REGEN_IMAGES)`.
- #14 `userKey.ts`: throw instead of returning `'anon'` (gate behind explicit dev flag).
- #17 `s3.ts getObjectAsDataUrl`: HEAD size guard before buffering.
- #12 `assetMirror.ts`: validate host (reuse SSRF guard) + streaming byte cap.
- #13 (SVG/origin): document invariant in AGENTS.md, no code.

---

## Execution: Inline (per goal directive — not pausing to choose). TDD + commit per task.
</content>
