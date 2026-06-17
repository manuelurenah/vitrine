# Agent Guide — `vitrine`

> **If you only read one thing:** Civitai OAuth + Buzz-powered campaign
> generator. Postgres-backed (Drizzle), MinIO/R2 for uploads. Demo:
> login → onboarding → brand dna → cook a campaign or photoshoot → review.

Next.js 16 App Router app on top of `@civitai/app-sdk`. The starter has
been extended with Drizzle (Postgres), the AWS S3 SDK (MinIO local / R2
prod), MSW (e2e mocks), and a Playwright suite that runs against an
isolated test database.

## Stack

- Next.js 16, App Router, TypeScript strict, React 19, Tailwind 3.4
- `@civitai/app-sdk` for all OAuth + orchestrator glue
- Postgres + Drizzle ORM (`src/lib/db/`) — required, app fails loud if `DATABASE_URL` unset
- S3-compatible object storage (MinIO local, R2 prod) — required for the asset uploader
- Encrypted-cookie sessions (no token storage in DB)
- MSW node interceptor for e2e (`src/instrumentation.ts`, gated on `MOCK_CIVITAI=1`)

## File layout

```
src/
├── app/
│   ├── page.tsx                            login or post-OAuth onboarding-gate redirect
│   ├── onboarding/[step]/                  5-step flow; each view persists state
│   ├── (app)/                              auth-guarded shell, also enforces onboarding
│   │   ├── campaigns/                      list · new · [id]
│   │   ├── photoshoot/                     list · new · [id]
│   │   ├── ads/                            list · new · [id] (Civitai ad creatives)
│   │   └── brand/                          dna · book · catalog · assets (+ /new uploader)
│   ├── api/
│   │   ├── auth/                           login · callback/civitai · logout · revoke
│   │   ├── campaigns/                      cook · estimate · [id]/tiles/[tileId]/regenerate
│   │   ├── ads/                            cook · estimate · [id] DELETE · [id]/export ·
│   │   │                                    [id]/tiles/[tileId]/{regenerate,download}
│   │   ├── photoshoot/cook/
│   │   ├── catalog/products/               GET · POST · [id] GET/PATCH/DELETE
│   │   ├── assets/                         GET list · POST finalize · presign/
│   │   └── workflow/[id]/                  long-poll snapshot; updates db on terminal
│   └── instrumentation.ts                  starts MSW node when MOCK_CIVITAI=1
├── components/                             ui · shell · login · onboarding · campaigns ·
│                                            photoshoot · ads · catalog · assets
└── lib/
    ├── env.ts                              Zod env validation
    ├── session.ts                          sealed-cookie session (read · write · refresh)
    ├── civitai.ts                          SDK wiring (fetchMe, buzz, orchestrator)
    ├── userKey.ts                          upserts `users` row; returns stable id
    ├── db/                                 Drizzle client + schema (14 tables, 8 enums)
    ├── onboarding.ts · brand.ts · catalog.ts · campaigns.ts · photoshoots.ts
    ├── adFormats.ts · adCampaigns.ts · adExport.ts · adCopy.ts  (Civitai ads)
    ├── generations.ts · buzz.ts · assets.ts
    └── s3.ts                               presigned PUT + public URL builder
```

## Patterns to keep

- **OAuth + tokens stay server-side.** Browser only ever sees the opaque `httpOnly` `civ_session` cookie. Never expose `access_token`, `refresh_token`, or `CIVITAI_CLIENT_SECRET`.
- **Session = sealed cookie.** Read via `getSession()` in `src/lib/session.ts`. If `null`, user is logged out. Don't reach into the cookie store anywhere else.
- **User key = drizzle FK.** Always call `getUserKey(session)` before writing any user-scoped row — it upserts the `users` row that everything else FKs to.
- **Onboarding gate.** `app/page.tsx` and `(app)/layout.tsx` both check `getOnboarding(userKey).completedAt`. Incomplete users get redirected to `/onboarding/<currentStep>`. If you add new app routes that should be gated, put them under `src/app/(app)/`.
- **Generation audit trail.** Every `submitWorkflow` call goes through `recordGeneration` + `recordBuzzEvent` (estimate + submit). Terminal workflow status triggers `syncAssetsFromSnapshot` to create the `assets` row and link it to the tile.
- **Buzz cost preview before submission.** Always call `estimate` and surface the cost; users blame the app, not Civitai.
- **All Civitai SDK calls happen in route handlers**, not RSCs. RSCs can call drizzle helpers in `lib/*` directly via `getSession()`.

## Patterns to avoid

- ❌ Storing tokens in `localStorage`, cookies-without-httpOnly, or in rendered HTML.
- ❌ Writing to user-scoped tables (`products`, `campaigns`, `assets`, …) without going through `getUserKey()` first.
- ❌ Skipping `recordGeneration` / `recordBuzzEvent` when submitting a new workflow — the audit + UI both depend on it.
- ❌ Mutating sessions or session-derived state in middleware.
- ❌ Hard-coding orchestrator base URLs — use the SDK defaults or env override.
- ❌ Adding new env vars without putting them in `.env.example` **and** validating them in `src/lib/env.ts`.

## Extending

| Task | How |
|---|---|
| New Civitai SDK call | Add to `src/lib/civitai.ts`. Don't call SDK from RSCs. |
| New OAuth scope | Bump `REQUESTED_SCOPES` in `src/lib/scopes.ts` + grant on the OAuth App. Users re-login. |
| New social preset / shoot template | Append to `PRESETS` / `PHOTOSHOOT_TEMPLATES`. `width`/`height` drive aspect ratio; `styleNotes` get injected into the prompt. |
| New ad size / format | Append to `AD_FORMATS` in `src/lib/adFormats.ts` (sizes are derived per-dimension; `nearestAspect` maps each to a generation ratio). Add to `recommendedAdSizeIds()` if it should be a default. The exact-pixel deliverable is produced by a server-side `sharp` crop in `src/lib/adExport.ts` — no per-size cook code needed. |
| New persisted entity | Add the table to `src/lib/db/schema.ts`, run `pnpm db:generate` to emit a migration, run `pnpm db:migrate`. Add a `lib/<entity>.ts` helper module with the same shape as `lib/catalog.ts`. |
| New env var | Add to Zod schema in `src/lib/env.ts` **and** `.env.example`. |
| New asset workflow | Use `presignUpload()` from `lib/s3.ts` for client uploads, then `createAsset()` from `lib/assets.ts` to persist. For orchestrator outputs, `syncAssetsFromSnapshot()` already runs from the workflow route. |
| Mock external service for e2e | Add an http handler to `src/mocks/handlers.ts`. Already covers `/api/v1/me`, buzz, and orchestrator. |

## Demo flow

1. Logged out → `<CivitaiSsoButton>` → `POST /api/auth/login` → 303 to Civitai authorize → user consents → `GET /api/auth/callback/civitai` → session sealed → 303 to `/`.
2. `app/page.tsx` reads session, calls `getOnboarding(userKey)`. If `completed_at` is null → redirect to `/onboarding/<currentStep>`; else → `/campaigns`.
3. User walks onboarding; visiting `/onboarding/next` sets `completed_at`.
4. From `/campaigns/new` (or `/photoshoot/new`), client submits a brief → server cooks per-tile workflows in parallel → persists campaign + tiles + generations + buzz events.
5. Client polls `/api/workflow/[id]?wait=15000`. On terminal status, server updates generation, creates asset rows, links to tile, records charged buzz once.

**Civitai ads** (`/ads`) reuse the same cook/estimate/poll plumbing as campaigns — brief → review → `POST /api/ads/cook` fans out one `submitImageGen` workflow per selected ad size (no LLM draft pass). Specifics: ad sizes come from `src/lib/adFormats.ts` (`AD_FORMATS` → `AD_SIZES`; `recommendedAdSizeIds()` seeds the picker); the generation `source` enum value is `ad_campaign`; `syncAssetsFromSnapshot`/`markTileFailed` are ad-aware and update `ad_campaign_tiles` by `workflow_id` on terminal polls. Exact-pixel deliverables are produced by a server-side `sharp` crop in `src/lib/adExport.ts` — `GET /api/ads/[id]/export` returns a zip of all done creatives; `GET /api/ads/[id]/tiles/[tileId]/download` returns one cropped PNG.

## Verifying changes

| You touched | Run |
|---|---|
| Anything in `src/` | `pnpm typecheck` |
| `next.config.mjs`, env, security headers | `pnpm build` |
| Schema (`src/lib/db/schema.ts`) | `pnpm db:generate` → review SQL → `pnpm db:migrate` (and `pnpm test:db:setup` to keep `vitrine_test` in sync) |
| Auth flow (`src/app/api/auth/**`, `lib/session.ts`) | `pnpm test:e2e` (the suite includes the real-OAuth `00-auth-flow` spec) |
| Cook / regenerate / workflow polling | `pnpm test:e2e` (50-campaigns, 60-photoshoot specs cook against MSW-mocked orchestrator) |

`pnpm test:e2e` needs a Civitai dev server with `testing-login` enabled and an OAuth app whose redirect URIs include both `http://localhost:3333/api/auth/callback/civitai` (dev) and `http://localhost:3334/...` (e2e). See [README › End-to-end tests](./README.md#end-to-end-tests) for the full prereqs.
