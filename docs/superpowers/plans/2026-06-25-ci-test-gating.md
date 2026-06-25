# CI Test Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run unit + e2e in CI on every PR to `main` and before the deploy image is published, so a failing suite blocks both merge and prod deploy.

**Architecture:** One reusable workflow (`test.yml`) runs unit + e2e against a disposable Postgres service. It is triggered directly on `pull_request` (the PR gate) and consumed via `workflow_call` by `docker-publish.yml`, whose `build-push` job gets `needs: test` (the pre-publish gate). Branch protection requires the PR check.

**Tech Stack:** GitHub Actions, Node 24, pnpm 10, Postgres 16 service container, Playwright (Chromium), Vitest, `gh` CLI.

## Global Constraints

- CI uses a disposable in-job Postgres service container only — never a shared/staging/prod DB.
- Tests run fully offline: `00-auth-flow` self-skips (no `E2E_REAL_OAUTH`); no Civitai dev server, no MinIO, no Redis.
- Required CI env (all non-sensitive, every external call is MSW-mocked): `CIVITAI_CLIENT_ID`, `CIVITAI_CLIENT_SECRET`, `SESSION_SECRET` (≥32 chars), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CIVITAI_BASE_URL`, `DATABASE_URL`, `TEST_DATABASE_URL`.
- Node 24 (matches `Dockerfile`), pnpm 10.
- Repo: `manuelurenah/vitrine`. Deploy = push to `main` → GHCR image → FluxCD auto-deploy.
- Jobs cannot `needs:` across workflows — the deploy gate consumes `test.yml` via `workflow_call`.
- Test definition lives in ONE file (`test.yml`); do not duplicate it.

## Notes on verification

GitHub Actions cannot run locally. Tasks 1 is fully locally verifiable. Tasks 2–3 are verified locally by YAML/syntax validation; their runtime behavior is verified live after push + PR (see "Live verification"). Task 4 (branch protection) runs after the PR exists.

---

## Task 1: Fix `test:unit` env loading

`vitest run` does not load `.env`, so 4 test files that import `src/lib/env.ts` fail with `Invalid environment variables`. Load `.env` when present.

**Files:**
- Modify: `package.json` (the `test:unit` and `test:unit:watch` scripts)

**Interfaces:**
- Produces: `pnpm test:unit` runs Vitest with `.env` auto-loaded (and works when `.env` is absent).

- [ ] **Step 1: Verify the current failure**

Run: `pnpm test:unit 2>&1 | tail -5`
Expected: FAIL — `Test Files  4 failed | 67 passed`, `Error: Invalid environment variables`.

- [ ] **Step 2: Update the scripts**

In `package.json`, change:

```jsonc
    "test:unit": "vitest run",
    "test:unit:watch": "vitest"
```

to:

```jsonc
    "test:unit": "node --env-file=.env ./node_modules/vitest/vitest.mjs run",
    "test:unit:watch": "node --env-file=.env ./node_modules/vitest/vitest.mjs"
```

Use plain `--env-file=.env` (local Node 20.13.1 does not support
`--env-file-if-exists` — it throws `bad option`). This matches the existing
`test:e2e` / `test:server` scripts, which already require `.env`. CI writes
`.env` before the unit step; local devs already have one.

- [ ] **Step 3: Verify it passes with `.env` present**

Run: `pnpm test:unit 2>&1 | tail -4`
Expected: PASS — `Test Files  71 passed (71)`, `Tests  586 passed (586)`.

- [ ] **Step 4: (consistency note — no separate check)**

`pnpm test:unit` now requires `.env`, exactly like `test:e2e` / `test:server`. On a fresh clone without `.env` it errors `node: .env: not found` — the same behavior as the other test scripts, by design. CI writes `.env` before this step.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "test: load .env in test:unit so vitest sees app env

vitest run does not load .env; 4 files import src/lib/env.ts and failed
on Invalid environment variables. Use --env-file-if-exists so it works
locally, in CI, and on a fresh clone without .env.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Reusable test workflow (`test.yml`)

Create the single test job: Postgres service, dummy env, unit + e2e. Triggered on PRs to `main` and callable via `workflow_call`.

**Files:**
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Produces: a workflow with one job `test`, triggered by `pull_request` (branch `main`) and `workflow_call`. Consumed by `docker-publish.yml` in Task 3.

- [ ] **Step 1: Create `.github/workflows/test.yml`**

```yaml
name: test

on:
  pull_request:
    branches: [main]
  workflow_call: {}

# Cancel superseded PR runs to save minutes (not for workflow_call, where the
# group is per deploy run anyway).
concurrency:
  group: test-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
          POSTGRES_DB: vitrine
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U app -d vitrine"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      CIVITAI_CLIENT_ID: ci
      CIVITAI_CLIENT_SECRET: ci
      SESSION_SECRET: ci_session_secret_0123456789abcdef0123456789abcdef
      NEXT_PUBLIC_APP_URL: http://localhost:3334
      NEXT_PUBLIC_CIVITAI_BASE_URL: http://civitai.invalid
      DATABASE_URL: postgres://app:app@localhost:5432/vitrine
      TEST_DATABASE_URL: postgres://app:app@localhost:5432/vitrine_test
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Write .env for --env-file scripts
        run: |
          cat > .env <<'EOF'
          CIVITAI_CLIENT_ID=ci
          CIVITAI_CLIENT_SECRET=ci
          SESSION_SECRET=ci_session_secret_0123456789abcdef0123456789abcdef
          NEXT_PUBLIC_APP_URL=http://localhost:3334
          NEXT_PUBLIC_CIVITAI_BASE_URL=http://civitai.invalid
          DATABASE_URL=postgres://app:app@localhost:5432/vitrine
          TEST_DATABASE_URL=postgres://app:app@localhost:5432/vitrine_test
          EOF

      - name: Set up test database
        run: pnpm test:db:setup

      - name: Install Playwright Chromium
        run: pnpm test:e2e:install

      - name: Unit tests
        run: pnpm test:unit

      - name: E2E tests
        run: pnpm test:e2e

      - name: Upload Playwright artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-artifacts
          path: |
            test-results/
            playwright-report/
          if-no-files-found: ignore
          retention-days: 7
```

- [ ] **Step 2: Validate the YAML**

Run: `command -v actionlint >/dev/null && actionlint .github/workflows/test.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/test.yml')); print('yaml ok')"`
Expected: `actionlint` reports no errors, OR `yaml ok` (if actionlint is not installed).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: reusable test workflow (unit + e2e against Postgres service)

Runs offline (no Civitai dev server); 00-auth-flow self-skips. Triggered
on PRs to main and callable via workflow_call for the deploy gate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Gate the deploy on tests (`docker-publish.yml`)

Add a `test` job that calls `test.yml` and make `build-push` depend on it. Red tests → no image → Flux never deploys.

**Files:**
- Modify: `.github/workflows/docker-publish.yml`

**Interfaces:**
- Consumes: `.github/workflows/test.yml` (Task 2) via `uses:`.

- [ ] **Step 1: Add the gating job**

In `.github/workflows/docker-publish.yml`, replace the `jobs:` section (everything from `jobs:` to the end of the file) with:

```yaml
jobs:
  test:
    uses: ./.github/workflows/test.yml

  build-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Compute image tag
        id: tag
        run: echo "tag=$(date -u +%Y%m%d%H%M%S)-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          build-args: |
            NEXT_PUBLIC_APP_URL=https://vitrine.civitai.com
            S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
            S3_PUBLIC_URL=https://s3.us-west-004.backblazeb2.com
          tags: |
            ghcr.io/${{ github.repository_owner }}/vitrine:${{ steps.tag.outputs.tag }}
            ghcr.io/${{ github.repository_owner }}/vitrine:latest
```

This keeps the `build-push` steps byte-for-byte identical to the current file; it only adds the `test` job, the `needs: test`, and per-job `permissions` (the top-level `permissions` block at the file head can stay or be removed — per-job is now authoritative; leave the existing top-level block as-is to minimize the diff).

- [ ] **Step 2: Validate the YAML**

Run: `command -v actionlint >/dev/null && actionlint .github/workflows/docker-publish.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/docker-publish.yml')); print('yaml ok')"`
Expected: no errors, OR `yaml ok`.

- [ ] **Step 3: Confirm the gate wiring**

Run: `grep -nE "needs: test|uses: ./.github/workflows/test.yml" .github/workflows/docker-publish.yml`
Expected: both lines present — `uses: ./.github/workflows/test.yml` under the `test` job and `needs: test` under `build-push`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "ci: block deploy publish on test failure

build-push now needs the reusable test job; a red unit/e2e suite means
no GHCR image is published, so FluxCD never deploys the bad commit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Live verification (after push + PR)

These run after the branch is pushed and a PR to `main` is opened (handled by the finishing-a-development-branch step). They verify the gate actually works.

- [ ] **V1: PR triggers the test workflow**

After opening the PR:
Run: `gh pr checks --watch`
Expected: a `test` check appears and runs (unit + e2e). Green on this branch (suite is known-green locally).

- [ ] **V2: Confirm the exact check name for branch protection**

Run: `gh pr checks --json name,state | python3 -c "import json,sys; print([c['name'] for c in json.load(sys.stdin)])"`
Expected: prints the check name(s). Note the test check's exact name (likely `test`); use it in Task 4.

---

## Task 4: Branch protection on `main` (after PR exists)

Require the test check before merge and block direct pushes. Outward-facing repo-settings change requiring admin on `manuelurenah/vitrine`.

**Files:** none (GitHub API call).

- [ ] **Step 1: Apply branch protection**

Using the exact check name from V2 (assumed `test` below), run:

```bash
gh api -X PUT repos/manuelurenah/vitrine/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "checks": [ { "context": "test" } ] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false
}
JSON
```

Expected: HTTP 200 with the protection JSON. If it fails with `403`/`Resource not accessible`, you lack admin — fall back to Step 3 (manual).

- [ ] **Step 2: Verify protection is active**

Run: `gh api repos/manuelurenah/vitrine/branches/main/protection --jq '.required_status_checks.checks'`
Expected: `[{"context":"test", ...}]`.

- [ ] **Step 3: Manual fallback (only if Step 1 failed on permissions)**

In GitHub → repo Settings → Branches → Add branch ruleset / protection rule for `main`:
- Require a pull request before merging.
- Require status checks to pass → search and select `test`.
- Require branches to be up to date before merging (strict).
- Do not allow force pushes / deletions.

---

## Self-Review notes

- **Spec coverage:** Goal 1 (PR gate) → Task 2 `pull_request` trigger + Task 4 branch protection. Goal 2 (pre-publish gate) → Task 3. Goal 3 (single definition) → Task 2 reusable workflow consumed in Task 3. `test:unit` env fix → Task 1. DB-in-CI → Task 2 service + env. All spec sections mapped.
- **Placeholders:** none. The branch-protection check name is confirmed live in V2 before Task 4 uses it (not a placeholder — a verified value).
- **Consistency:** env var names, `vitrine_test`, the `test` job name, and `needs: test` match across Tasks 2/3/4. Node 24 / pnpm 10 consistent with `Dockerfile`.
