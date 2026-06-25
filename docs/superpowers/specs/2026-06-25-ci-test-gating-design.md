# CI Test Gating — Block Prod Deploys on Test Failure — Design

**Date:** 2026-06-25
**Status:** Approved (design)
**Branch:** `feature/e2e-offline-parallel` (continues the offline-e2e work this CI runs)

## Problem

There is no automated testing in CI. The deploy pipeline is fully automatic:
`.github/workflows/docker-publish.yml` runs on **push to `main`**, builds the
Docker image, pushes it to GHCR (`<ts>-<sha>` + `latest`), and FluxCD on the
Civitai cluster watches the tag stream and auto-deploys to
`vitrine.civitai.com`. So the moment an image lands in GHCR, it ships — broken
or not. Nothing runs the unit or e2e suites before that.

The deploy trigger is "an image appears in GHCR." Therefore "prevent deploy on
test failure" means: **do not publish the image unless tests pass**, and
ideally **stop bad code from reaching `main` in the first place**.

## Enabler

The offline-by-default e2e work (same branch) is what makes CI e2e feasible:
the suite no longer needs a Civitai dev server or a real account — only a
Postgres service and Chromium. `src/lib/env.ts` confirms tests need just dummy
`CIVITAI_CLIENT_ID` / `CIVITAI_CLIENT_SECRET` / `SESSION_SECRET` (≥32 chars) +
`NEXT_PUBLIC_APP_URL`; S3 is optional (the uploader spec is stubbed) and there
is no `REDIS` var (rate limiting does not import redis). So the only CI service
needed is Postgres.

## Goals

1. Run unit + e2e on every PR to `main`; block merge unless green
   (branch protection).
2. Run unit + e2e before the deploy image is published; if red, publish no
   image so Flux never deploys.
3. Keep the test definition in one place (no duplication between the two
   gates).

## Non-goals

- Running tests against any shared/staging/prod database (CI uses a disposable
  in-job Postgres service).
- Real-OAuth (`E2E_REAL_OAUTH=1`) in CI — it needs the Civitai dev server and
  stays a local/manual check; `00-auth-flow` is skipped in CI.
- pnpm/browser caching tuning (can be added later if CI time is a concern).

## Architecture

A single reusable test workflow consumed by both gates:

```
PR → main ───────────────► test.yml (pull_request)  ── required check ─► merge
                                                          (branch protection)

push → main ─► docker-publish.yml
                  ├─ test        (uses: ./.github/workflows/test.yml)
                  └─ build-push  (needs: test) ─► GHCR ─► Flux
                         ✗ test red ⇒ no image ⇒ no deploy
```

Jobs cannot `needs:` across workflows, so the deploy gate consumes the test
workflow via `workflow_call`. The same file's `pull_request` trigger provides
the PR gate. One definition, two entry points.

## Components

### 1. `.github/workflows/test.yml` (new)

`on: { pull_request: { branches: [main] }, workflow_call: {} }`, plus a
`concurrency` group keyed on the ref with `cancel-in-progress: true` so
superseded PR pushes don't pile up runs.

Single `test` job on `ubuntu-latest`:

- **Services:** `postgres:16` with `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`,
  `POSTGRES_DB=vitrine`, port `5432:5432`, health-checked with `pg_isready`.
- **Steps:**
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` (pnpm 10) + `actions/setup-node@v4` (Node 24,
     `cache: pnpm`)
  3. `pnpm install --frozen-lockfile`
  4. Write a throwaway `.env` with: `CIVITAI_CLIENT_ID=ci`,
     `CIVITAI_CLIENT_SECRET=ci`, `SESSION_SECRET=<32+ char throwaway>`,
     `NEXT_PUBLIC_APP_URL=http://localhost:3334`,
     `NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid`,
     `DATABASE_URL=postgres://app:app@localhost:5432/vitrine`,
     `TEST_DATABASE_URL=postgres://app:app@localhost:5432/vitrine_test`.
     All values are non-sensitive — every external call is MSW-mocked, and the
     `SESSION_SECRET` only seals the offline test user's cookie.
  5. `pnpm test:db:setup` (connects to the `postgres` maintenance db, creates
     `vitrine_test`, migrates it)
  6. `pnpm test:e2e:install` (Chromium + `--with-deps`)
  7. Unit: `pnpm test:unit` (now env-loaded — see component 3)
  8. `pnpm test:e2e` (offline; `00-auth-flow` self-skips)
  9. `actions/upload-artifact@v4` on failure: `playwright-report/` +
     `test-results/`

### 2. `.github/workflows/docker-publish.yml` (modify)

Add a `test` job and gate the existing publish job on it:

```yaml
jobs:
  test:
    uses: ./.github/workflows/test.yml
  build-push:
    needs: test
    runs-on: ubuntu-latest
    # ...unchanged...
```

`build-push` already declares `permissions: packages: write`. The reusable
`test` job needs only `contents: read`; declare per-job permissions so the
test job cannot publish.

### 3. `package.json` — fix `test:unit` env loading (small, in-scope)

`vitest run` does not load `.env`, so 4 test files fail on `Invalid
environment variables` (they import `src/lib/env.ts`). Change:

```jsonc
"test:unit": "node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run"
```

`--env-file-if-exists` (Node ≥20.12, satisfied by local Node 20.13 and CI Node
24) loads `.env` when present and silently continues when absent — so
`pnpm test:unit` works locally, in CI, and on a fresh clone without `.env`.
`test:unit:watch` gets the same treatment for consistency.

### 4. Branch protection on `main` (gh api)

Require the PR test check before merge and stop direct pushes:

```bash
gh api -X PUT repos/manuelurenah/vitrine/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[checks][][context]=test' \
  -f 'enforce_admins=false' \
  -f 'required_pull_request_reviews=' \
  -f 'restrictions=' \
  -F 'required_linear_history=false' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

(The exact check `context` string is the `test` job name as it appears on a
PR-triggered run; confirm from the first PR run and adjust if GitHub reports a
namespaced name.) This is an outward-facing repo-settings change requiring
admin on `manuelurenah/vitrine`. Attempt via `gh api`; if it fails on
permissions, fall back to a manual GitHub Settings → Branches checklist. The
change is reversible (delete the protection rule).

## Database in CI

Tests connect to a disposable in-job Postgres service container (created fresh
per run, destroyed at job end) at `localhost:5432`. `test:db:setup` creates and
migrates `vitrine_test`; both the e2e Next test server (`DATABASE_URL`) and the
`pg` test helpers (`TEST_DATABASE_URL`) target `vitrine_test`. The production
`DATABASE_URL` is injected at runtime by Flux on the cluster and is never
present in CI — CI cannot reach prod/staging Postgres.

## Risks & mitigations

- **CI wall-clock** (~4-6 min: install + Chromium + db setup + Next dev compile
  + suite). Acceptable for a gate; pnpm + Playwright-browser caching can trim it
  later.
- **Worker count in CI**: `playwright.config.ts` yields 4 workers; ubuntu-latest
  has ~4 cores and the single Next dev server is the bottleneck. Should pass; if
  flaky, cap CI to 3 via `--workers=3` in the e2e step.
- **Required-check name mismatch** for branch protection: verify the exact check
  name from the first PR run and adjust the `gh api` call.
- **Reusable-workflow permissions**: set least-privilege per job so the test job
  can't write packages.

## Verification

- Open a PR with a deliberately failing test → the `test` check is red and merge
  is blocked.
- Push a green change to `main` → `test` job passes, `build-push` runs, image
  published.
- Simulate a red `main` push (temporarily) → `build-push` is skipped, no GHCR
  image, no Flux deploy.
- `pnpm test:unit` passes locally with and without `.env` present.
