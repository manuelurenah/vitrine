# E2E Suite: Offline-by-Default + Parallel — Design

**Date:** 2026-06-25
**Status:** Approved (design)
**Branch:** `feature/e2e-offline-parallel`

## Problem

Local e2e is slow and dependency-heavy. Today every spec run requires:

1. A running Civitai dev server, reachable at `NEXT_PUBLIC_CIVITAI_BASE_URL`,
   with the `testing-login` NextAuth provider enabled.
2. A real Civitai account (the `testing-login` user) that the suite signs in
   as during `globalSetup`.
3. A Postgres test database (`vitrine_test`).

Startup hits the Civitai dev server for a CSRF + `testing-login` + session
handshake (`e2e/global-setup.ts:90-157`) *before any spec runs* — if that
server is down or the env var is unset, the entire suite aborts. The run is
also fully serial (`workers: 1`, `fullyParallel: false`).

## Audit findings (what actually depends on what)

| External dependency | Specs that need it | Verdict |
|---|---|---|
| **Civitai dev server** (real network) | **only `00-auth-flow`** | soft — removable for the other 20 |
| **Postgres test DB** | all except `70-api-health` | hard — app fails loud without `DATABASE_URL`; 7 specs assert real rows |
| **MinIO / S3** | none — `40-assets-uploader` already stubs presign/PUT/finalize | already gone |
| **MSW** (Civitai me/buzz, orchestrator, openai, scrape, images) | cooking/generation specs | already mocked |

Key facts:

- 20 of 21 specs already run on a pre-sealed `civ_session` cookie + MSW =
  zero real network. The only thing forcing them to need the Civitai dev
  server is the unconditional `testing-login` handshake in `globalSetup`,
  whose captured cookies are consumed **only** by `00-auth-flow`.
- `00-auth-flow` genuinely needs the live server: it clears `civ_session` and
  drives a real browser OAuth round-trip (authorize → consent → callback).
  MSW is a node/server-side interceptor and cannot intercept the browser's
  cross-origin navigation to the Civitai authorize page.
- Postgres cannot be mocked away without gutting the e2e value — for 7 specs
  the DB *is* the system under test (they assert persisted rows via
  `countRows` / `getTile` / `countTileVersions` / `getProductAssetIds` /
  `getAssetCollection` / `getLatestVersionPalette`). The lever for the DB is
  cheaper/cleaner *setup*, not removal.

Specs whose DB write is the thing under test (must keep real DB asserts):
`20-catalog`, `35-catalog-picker`, `45-account-delete`, `52-creative-editor`,
`53-variant-editing`, `53-version-history`, `55-photoshoot-cross-flow`.

## Goals

1. `pnpm test:e2e` runs **offline by default** — no Civitai dev server, no real
   account. Real OAuth becomes opt-in via `E2E_REAL_OAUTH=1`.
2. Test DB is **persistent but deterministically clean** — clean slate
   guaranteed at start, never torn down (faster reruns, post-mortem
   debugging survives, robust to crashed runs).
3. Suite runs **in parallel** across workers, with per-worker data isolation.

## Non-goals

- Removing the Postgres dependency (PGlite/embedded) — rejected; real DB is
  required and the asserts depend on Postgres fidelity.
- Mocking the browser OAuth flow for `00-auth-flow` — it exists specifically
  to exercise the real round-trip.
- Auto-spinning Postgres via testcontainers — out of scope; `pnpm dev:up`
  stays the way to get a local Postgres.

## Design

### Part A — Decouple from the Civitai dev server

- Gate the `testing-login` handshake in `e2e/global-setup.ts` behind
  `E2E_REAL_OAUTH === '1'`. Offline default skips it entirely (no network).
- `00-auth-flow.spec.ts` gets `test.skip(process.env.E2E_REAL_OAUTH !== '1',
  'real OAuth only')` so it is skipped in the normal offline run.
- `playwright.config.ts` stops hard-requiring `NEXT_PUBLIC_CIVITAI_BASE_URL`.
  A dummy value is fine offline; it is required only when `E2E_REAL_OAUTH=1`.
- The per-spec `civ_session` cookie moves OUT of `globalSetup` and INTO a
  worker-scoped fixture (see Part C). In real mode, `globalSetup` still writes
  the Civitai NextAuth cookies to `.auth/civitai-cookies.json` so the auth
  spec's browser is already logged into Civitai and lands on the **consent**
  screen rather than a **login** screen.

### Part B — Truncate-all at globalSetup; persistent DB

- `globalSetup` (runs in both modes) connects to the test DB, dynamically
  lists `public` tables excluding `__drizzle*`, and issues
  `TRUNCATE <tables> RESTART IDENTITY CASCADE`. This guarantees a clean slate
  on entry regardless of how the previous run ended (including crash / Ctrl-C).
- The DB is **never dropped**. Migrations re-run only via `pnpm test:db:setup`
  when the schema changes.
- A new `e2e/global-teardown.ts` calls the existing-but-unused
  `closeDb()` to close pg pools cleanly at the end. It performs **no** data
  teardown.

Rationale for clean-at-start over drop-at-end: drop-at-end is slower (re-create
+ re-migrate every run), destroys the rows you need to inspect after a failure,
and does not run if the suite crashes — i.e. it fails to be "neat" exactly when
neatness matters. Setup-time truncate is deterministic and robust.

### Part C — Parallel workers + per-worker user isolation

**Parallelism model: file-level.** Keep `fullyParallel: false`, set
`workers: N`. Playwright assigns whole spec *files* to workers concurrently;
tests *within* a file remain serial on a single worker. This matches the
suite's existing isolation unit (per-file `beforeAll` seeds, tests share that
seed).

> Rejected `fullyParallel: true`: it can split a single file's tests across
> different workers (hence different users), which breaks any shared
> `beforeAll`-seeded state. The throughput gain over file-level parallelism is
> marginal for a 21-file suite and the correctness risk is real.

**Isolation = one synthetic test user per worker slot.**

- Playwright exposes `process.env.TEST_PARALLEL_INDEX` (0…N-1, stable for a
  worker's lifetime, reused as a worker slot picks up later files) inside each
  worker process.
- A single shared formula derives the user id:
  `userId = process.env.TEST_USER_ID ?? String(90000 + parallelIndex)`.
  The synthetic `90000+` base avoids collisions with real Civitai ids.
- `e2e/helpers/db.ts`: replace the hard-coded `TEST_USER_ID = '1'` with this
  formula. Every helper already defaults its `userId` param to this constant,
  so call sites need **no** changes — they automatically target the worker's
  user.
- `e2e/fixtures.ts`: extend Playwright `test` with a **worker-scoped**
  `storageState` override that seals a `civ_session` cookie for the worker's
  `userId` (and merges `.auth/civitai-cookies.json` when present, for real
  mode). The cookie user and the DB user both derive from the same
  `parallelIndex`, so they are always consistent — and because the value comes
  from an env var rather than a lazily-initialized fixture, there is no
  fixture-ordering hazard with `beforeAll` hooks.
- New `e2e/helpers/session.ts`: `sealCivSession(userId)` builds the sealed
  cookie value (using `sealCookie` from `@civitai/app-sdk` + `SESSION_SECRET`),
  shared by the fixture and by `globalSetup`/real-mode code.

**Auth-spec exception.** `00-auth-flow` runs only in real mode and must use the
real Civitai `testing-login` user. Real-mode runs set `TEST_USER_ID=1` so the
app-side user and the Civitai-side user align; the spec resets user `1`
explicitly. It is skipped in the normal parallel offline run, so it never
collides with the synthetic per-worker users.

**Connection budget.** `pg` pool `max: 4` per worker × N workers, plus the
shared app drizzle pool on the single test Next server. Comfortably under
Postgres' default `max_connections = 100` for any reasonable N.

## Files touched

| File | Change |
|---|---|
| `e2e/global-setup.ts` | truncate-all (both modes); gate `testing-login` handshake on `E2E_REAL_OAUTH`; write `.auth/civitai-cookies.json` in real mode only; stop sealing the shared `civ_session` here |
| `e2e/global-teardown.ts` *(new)* | call `closeDb()` |
| `e2e/fixtures.ts` | worker-scoped per-user `storageState` override |
| `e2e/helpers/session.ts` *(new)* | `sealCivSession(userId)` |
| `e2e/helpers/db.ts` | `TEST_USER_ID` derived from per-worker formula |
| `playwright.config.ts` | `workers: N`; remove global `use.storageState`; soften `NEXT_PUBLIC_CIVITAI_BASE_URL` requirement; wire `globalTeardown` |
| `e2e/00-auth-flow.spec.ts` | `test.skip` unless `E2E_REAL_OAUTH=1`; use fixed user `1` |
| `.env.example` | add `E2E_REAL_OAUTH` (commented), note offline default |
| `README.md` (e2e section) | document offline default + how to run real-OAuth mode |

## Worker count

Default `workers: process.env.CI ? 4 : undefined` (Playwright's local default
is ~half the CPU cores). Overridable via the standard `--workers` flag /
`PLAYWRIGHT_WORKERS` if desired.

## Risks & mitigations

- **Worker/user mismatch** between cookie and DB helper → single shared
  formula keyed on `TEST_PARALLEL_INDEX`.
- **Real-OAuth path less exercised** after the refactor → kept behind the env
  gate; validate manually when the Civitai dev server is up.
- **`fullyParallel: false` correctness** assumes no cross-file shared user
  state → confirmed by the audit (every spec is isolated to its own user via
  `resetUserData`).
- **DB connection exhaustion** under high N → bounded as above; cap N if
  needed.
- **`storageState` as a worker fixture returning an object** is a supported
  Playwright pattern (the option type is `string | StorageState`).

## Verification

- `pnpm typecheck` after the TS changes.
- Offline: with the Civitai dev server **stopped** and a dummy
  `NEXT_PUBLIC_CIVITAI_BASE_URL`, `pnpm test:e2e` runs green (20 specs;
  `00-auth-flow` skipped), faster than serial, no network to Civitai.
- Real mode: with the Civitai dev server up and `E2E_REAL_OAUTH=1`,
  `00-auth-flow` runs and passes.
- DB: a deliberately failed run leaves rows in `vitrine_test` for inspection;
  the next run starts clean.
