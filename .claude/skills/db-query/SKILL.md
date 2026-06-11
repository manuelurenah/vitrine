---
name: db-query
description: Run read-only PostgreSQL queries against the vitrine local dev database for debugging, data inspection, and EXPLAIN ANALYZE. Use when you need to inspect rows, verify what cooking/onboarding/buzz wrote, check generation/asset/campaign state, or test SQL. Reads DATABASE_URL from the project .env. Read-only unless --writable is passed.
---

# vitrine db-query

Ad-hoc PostgreSQL access to the local `vitrine` database (`DATABASE_URL` in
`.env`). Read-only by default; writes require an explicit `--writable` flag.

The connection string is **never hardcoded** — `query.mjs` loads `DATABASE_URL`
from the project-root `.env` (already-set env vars win, so CI/shell exports are
respected). Don't paste credentials into queries or this file.

## Running queries

```bash
node .claude/skills/db-query/query.mjs "SELECT count(*) FROM users"
```

| Flag | Description |
|------|-------------|
| `--explain` | Wrap the query in `EXPLAIN ANALYZE` |
| `--json` | Output rows as JSON (good for piping/processing) |
| `--writable` | Allow `INSERT/UPDATE/DELETE/...` — **ask the user first** |
| `--timeout <s>`, `-t` | Statement timeout in seconds (default: 30) |
| `--file`, `-f` | Read the query from a file |
| `--quiet`, `-q` | Results only, no connection/row-count headers |

```bash
# Inspect rows
node .claude/skills/db-query/query.mjs "SELECT id, username, tier FROM users LIMIT 5"

# Check index usage / plan
node .claude/skills/db-query/query.mjs --explain "SELECT * FROM campaign_tiles WHERE campaign_id = 'abc'"

# JSON for further processing
node .claude/skills/db-query/query.mjs --json "SELECT status, count(*) FROM generations GROUP BY status"

# From a file
node .claude/skills/db-query/query.mjs -f /tmp/probe.sql
```

## Safety

1. **Read-only by default.** The script blocks `INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, COPY, MERGE` (leading SQL comments can't smuggle a write past the guard — they're stripped first).
2. **`--writable` requires intent.** Only pass it when the user explicitly asks to mutate data. Confirm with the user before running a write.
3. **Local dev only.** Targets whatever `DATABASE_URL` points at — normally `postgres://app:app@localhost:5432/vitrine`. For schema changes use the existing `pnpm db:generate` / `db:migrate`, not this skill.

## Schema reference

Source of truth: `src/lib/db/schema.ts` (Drizzle). Read it for exact columns,
FKs, and indexes before writing non-trivial queries.

**Column naming gotcha:** TypeScript uses camelCase, SQL uses snake_case.
`civitaiId` → `civitai_id`, `displayName` → `display_name`,
`createdAt` → `created_at`. Query the snake_case names.

**Tables:** `users`, `onboarding_state`, `brand_profiles`, `products`,
`assets`, `product_assets`, `campaigns`, `campaign_tiles`, `tile_versions`,
`photoshoots`, `photoshoot_tiles`, `generations`, `buzz_events`.

**Enums:** `tile_status` (queued/cooking/done/failed), `product_status`
(live/draft/archived), `onboarding_step`, `asset_kind`
(upload/generated/reference), `asset_owner` (user/brand/product/tile),
`buzz_event_kind` (estimate/submit/refund), `generation_source`,
`generation_media_type` (image/video), `workflow_status`.

List live tables/columns straight from the DB when unsure:

```bash
node .claude/skills/db-query/query.mjs "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1"
node .claude/skills/db-query/query.mjs "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns' ORDER BY ordinal_position"
```
