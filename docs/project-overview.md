# Vitrine (Civitai × Pomelli-style)

> Working title. A Civitai-powered take on Google Pomelli: upload product photos, pick a target audience/industry, generate a full pack of on-brand social and ad content in minutes.

## One-liner

Pomelli, but powered by Civitai. Bring your product photos, we generate the marketing campaign — images, posts, video clips, ad creatives — tuned to your audience and industry, with Civitai's Buzz economy under the hood.

## The pitch

Small businesses, indie creators, and Shopify/Etsy sellers spend hours assembling product shots, lifestyle photography, and ad creatives. Pomelli solves this for established brands by scraping their website to learn their visual identity. Our version goes further: users upload product photos directly, pick a target audience and industry, and we generate a full multi-format asset pack using Civitai's orchestrator — high-quality stills, short-form video, sized-for-channel ad creatives, all editable in-app.

No training. No LoRA wait time. Inputs go in, marketing pack comes out.

## How Pomelli works (reference)

Pomelli's three-step flow:

1. **Business DNA** — paste a URL, AI analyzes site to extract brand tone, fonts, colors, imagery style
2. **Campaign Ideas** — tool proposes campaign concepts tuned to that brand
3. **Asset Generation** — produces IG posts, FB ads, YouTube thumbnails, Google Ads, email banners, animated videos (Veo 3.1), studio product photos (Nano Banana 2). All editable and downloadable.

See: [Google blog announcement](https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/) · [Pomelli on Google Labs](https://labs.google.com/pomelli/about)

## How our version works

Three-step flow, adapted to leverage Civitai's strengths:

### Step 1 — Brand setup

- **Required:** upload 3-13-10 product photos (phone-quality OK)
- **Optional:** paste website / Etsy / Shopify URL → we scrape for brand colors, tone, hero imagery
- **Optional:** brand name + 1-line description
- **VLM auto-tags** each photo (product type, dominant color, material, style cues)

Output: a lightweight "Brand Profile" — product catalog + extracted palette + tone descriptor. No model training. Stored on user account so they can return.

### Step 2 — Target picker

User selects:

- **Audience:** Gen Z / Millennials / Parents / Professionals / Luxury / Budget-conscious / Outdoor enthusiasts / etc.
- **Industry preset:** Jewelry / Food & Beverage / Apparel / Beauty / Tech accessories / Home decor / Fitness / Pet / Handmade / etc.
- **Campaign goal:** Awareness / Launch / Holiday / Sale / Lifestyle / Behind-the-scenes
- **Channels:** IG (square + story + reel) / TikTok / Facebook / Pinterest / Email header / Web hero

Each combination maps to a tuned prompt template + orchestrator workflow config (base model, sampler, aspect ratio, style modifiers).

### Step 3 — Asset generation

We generate an **Asset Pack** — a multi-format set rendered in one batch:

- 4 lifestyle shots (product in context, on-brand scene)
- 2 studio product shots (clean background, ad-ready)
- 1 hero banner (wide, web-ready)
- 1 short video clip (3-5s, product reveal or motion)
- 3 social caption suggestions (LLM-generated, tone-matched)

User reviews in a grid → edit, regenerate individual tiles, swap presets, download.

## Civitai differentiators vs Pomelli

| Capability       | Pomelli                   | Our version                                                     |
| ---------------- | ------------------------- | --------------------------------------------------------------- |
| Image generation | Nano Banana 2 (Google)    | Civitai orchestrator: Flux, SDXL, Pony, custom community models |
| Video generation | Veo 3.1 (Google)          | Civitai orchestrator: Wan, Kling, Veo (where available)         |
| Style breadth    | Locked to Google models   | Hundreds of community styles via base model + style selection   |
| Cost model       | Free beta (Google-funded) | Buzz spend (transparent, user-controlled, monetizable)          |
| Customization    | Limited preset edits      | Per-tile regeneration, model swap, prompt edit, seed lock       |
| Identity         | Google account            | Civitai OAuth (showcase)                                        |

## Core features (MVP scope for hackathon)

### Must-have

- **Civitai OAuth** sign-in
- **Product photo upload** (3-10 images, drag-drop, client-side resize)
- **VLM auto-tagging** of uploaded photos
- **Audience + Industry + Goal pickers** (curated taxonomy, ~6 options each)
- **Channel multi-select** (IG square / IG story / TikTok / hero / email)
- **Prompt template library** keyed on (industry × audience × goal × channel)
- **Asset Pack generator** — parallel orchestrator calls, progress per tile
- **Result grid** — regenerate single tile, swap preset, download all
- **Buzz cost preview** (`whatif`) at every step, total upfront before run

### Should-have

- **Brand color extraction** from uploaded photos (k-means on hero shot)
- **Caption / copy generation** via LLM (tone-matched to industry + audience)
- **Short video clip** via img2vid orchestrator workflow
- **Saved Brand Profiles** — reusable across campaigns
- **Pack history** — review past generations, re-download

### Stretch

- **Website scraper** for brand DNA (URL → colors, fonts, tone)
- **Background swap** mode (mask product, regen scene only)
- **Variation explorer** — slider for "more realistic ↔ more stylized"
- **A/B compare** — same product, two audiences, side-by-side
- **Multi-product collections** — group products into one campaign
- **Direct export to Shopify / Etsy / Meta Ads Manager** via their APIs

## User flow

1. Land → "Generate marketing content for your product in 60 seconds" → CTA: Sign in with Civitai
2. OAuth → onboarding tour (3 cards)
3. **Brand setup** screen: upload photos, optional name/URL, see VLM tags populate live
4. **Target picker** screen: 3 dropdown groups + channel multi-select; live preview of prompt
5. **Cost preview** modal: "This pack costs ~X Buzz. Continue?" with breakdown per tile
6. **Generation** screen: 7-9 tiles render in parallel, progress per tile, total ETA
7. **Review** screen: grid view, hover → regen / edit prompt / download single
8. **Export**: Download all (ZIP) / Download per-channel / Share preview link

## Tech stack

### Strategy: local containers for dev, managed for prod

All stateful infra runs as local Docker containers during development — no third-party signups for day-one productivity, work offline, fast iteration. The same client SDKs talk to managed equivalents in prod via endpoint swap in `.env`. Code stays identical; only connection strings differ between `.env.development` and `.env.production`.

| Layer          | Dev (local container) | Prod (managed)         | Why same SDK works                                          |
| -------------- | --------------------- | ---------------------- | ----------------------------------------------------------- |
| Postgres       | `postgres:16-alpine`  | Vercel Postgres (Neon) | Standard Postgres wire protocol                             |
| Object storage | `minio/minio`         | Cloudflare R2          | S3-compatible API → `@aws-sdk/client-s3` works against both |
| Cache / KV     | `redis:7-alpine`      | Upstash Redis          | TCP Redis protocol → `ioredis` works against both           |

### Foundation

- **Starter:** [`civitai/civitai-app-starters`](https://github.com/civitai/civitai-app-starters) → `starters/next-app`
- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind v3
- **SDK:** `@civitai/app-sdk` v0.2 — OAuth + PKCE, encrypted-cookie sessions, orchestrator client
- **Validation:** Zod (request bodies, env, prompt template payloads)
- **Env:** `@t3-oss/env-nextjs` (already in starter)

### Database

- **Dev:** `postgres:16-alpine` container, port 5432, named volume for persistence across `docker compose down`
- **Prod:** Vercel Postgres (Neon-backed) — single-region, free tier covers demo load
- **ORM:** Drizzle — schema-as-TS, no codegen step, faster hackathon iteration than Prisma
- **Migrations:** `drizzle-kit push` for dev (instant); `drizzle-kit generate` → SQL committed for prod apply
- **Tables (initial):**
  - `users` — `civitai_id` PK, `created_at`
  - `brand_profiles` — `id`, `user_id`, `name`, `palette` jsonb, `tone`, `source_url`
  - `brand_assets` — `id`, `brand_id`, `storage_key`, `vlm_tags` jsonb, `dominant_color`
  - `campaigns` — `id`, `brand_id`, `audience`, `industry`, `goal`, `channels` text\[\]
  - `asset_packs` — `id`, `campaign_id`, `total_buzz`, `status`, `created_at`
  - `pack_tiles` — `id`, `pack_id`, `workflow_id`, `type`, `channel`, `storage_key`, `prompt`, `seed`, `status`

### Object storage

- **Dev:** MinIO container, port 9000 (API) + 9001 (web console), auto-create buckets via init script
- **Prod:** Cloudflare R2 (S3-compatible, **zero egress** — critical for image-heavy app)
- **SDK:** `@aws-sdk/client-s3` with endpoint + credentials from env (MinIO local / R2 prod); presigned PUT for uploads, presigned GET for short-lived downloads
- **Buckets/prefixes:**
  - `uploads/{user_id}/{uuid}` — raw product photos (7-day lifecycle on R2)
  - `assets/{pack_id}/{tile_id}` — generated tiles (kept until user deletes pack)
  - `thumbs/{...}` — web-sized previews (generated on first read)

### Image delivery

- **Dev:** `next/image` direct from MinIO via public bucket policy on localhost
- **Prod:** Cloudflare CDN in front of R2 (public bucket binding) — `cdn.<our-domain>` → R2 origin
- **Resize:** Cloudflare Images variants OR `next/image` loader with on-the-fly query params
- **Upload pipeline:** drag-drop → client-side resize (max 2048px, JPEG q85) → presigned PUT → server records key in `brand_assets`
- **Color extraction:** client-side k-means on hero shot — no API call, no Buzz

### Cache / KV

- **Dev:** `redis:7-alpine` container, port 6379, no auth
- **Prod:** Upstash Redis (serverless, region-pinned, free tier) — accessed via TCP (not REST) so `ioredis` works in both environments
- **Client:** `ioredis` (single dependency, identical API dev/prod)
- **Use cases:** VLM tag cache keyed by `sha256(image)`, prompt-template cache, per-user rate limit, orchestrator job-id → user_id lookup

### Generation orchestration

- **Submit:** Civitai orchestrator via `@civitai/app-sdk` — `whatif=true` for cost preview, then real submit
- **Polling:** TanStack Query `useQuery` on `/api/workflow/[id]` with backoff (1s → 3s → 5s) — reuses starter pattern, no server queue needed
- **Parallelism:** one workflow per tile, submitted in parallel via `Promise.allSettled`; tiles render and stream into the grid independently
- **No background workers:** all long-running work is on the orchestrator side; our serverless routes only kick off and read status

### VLM auto-tagging

- **Path A (preferred):** Civitai orchestrator VLM workflow (Florence-2 / BLIP) if exposed via `@civitai/app-sdk`
- **Path B (fallback):** Replicate or Together-hosted Florence-2 endpoint, called server-side from `/api/tag`
- **Decision gate:** confirm Path A availability Day 1; switch to B if not ready

### LLM (caption / copy)

- **Civitai LLM client** (see `docs/features/civitai-llm-client.md`) — Gemini Flash or Llama via orchestrator
- **Structured prompt** with `{industry, audience, goal, brand_tone}` injected from Brand Profile
- **Output:** 3 caption variants per pack, returned alongside tile metadata

### State management

- **Server:** Drizzle queries from RSC + route handlers; session via app-sdk cookie
- **Client:** TanStack Query for orchestrator polling + asset-pack mutations; Zustand only if picker / regen state outgrows local component state
- **Forms:** React Hook Form + Zod (target picker, per-tile prompt edit)

### Local dev environment

Single `docker-compose.yml` at repo root brings up Postgres, MinIO, Redis. `pnpm dev` runs Next.js on the host, talking to containers via localhost.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: product_studio
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data

  minio-init:
    image: minio/mc
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://minio:9000 minioadmin minioadmin;
        mc mb -p local/uploads local/assets local/thumbs;
        mc anonymous set download local/thumbs;
      "

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
  miniodata:
```

Scripts in `package.json`:

```json
{
  "scripts": {
    "dev:up": "docker compose up -d",
    "dev:down": "docker compose down",
    "dev:reset": "docker compose down -v && docker compose up -d",
    "dev": "pnpm dev:up && next dev",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

`.env.development` (committed, no secrets):

```plain
DATABASE_URL=postgres://app:app@localhost:5432/product_studio
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_ASSETS=assets
S3_PUBLIC_URL=http://localhost:9000
REDIS_URL=redis://localhost:6379
```

### Deployment & hosting

- **Host:** Vercel — starter is Vercel-button-deployable; serverless functions cover every route
- **Why not deploy via containers too:** 1-week hackathon, no long-running workers (orchestrator owns compute), Vercel handles SSL / preview deploys / autoscale for free. Compose stays a dev tool only.
- **Post-hackathon path:** if we want full container parity (dev = prod), ship the same Compose file to [Fly.io](http://Fly.io) (`fly launch` reads `docker-compose.yml`) or Railway. Defer until product validates.

### Observability

- **Errors:** Sentry (free tier, official Next.js integration) — prod only, no-op in dev
- **Analytics:** Vercel Analytics for page views + demo funnel
- **Logs:** Vercel runtime logs; structured JSON via `pino` if post-hoc debugging needs it
- **Buzz audit:** every `submitWorkflow` logged with `user_id`, `workflow_id`, `buzz_estimated`, `buzz_charged` to a `buzz_events` table for the demo metrics screen

### Dev / CI

- **Package manager:** pnpm (matches starter and Civitai monorepo)
- **Lint/format:** ESLint (starter config) + Prettier
- **Tests:** Playwright e2e (auth + estimate flow, starter ships these); skip unit tests for hackathon
- **CI:** GitHub Actions — typecheck + lint + e2e on PR; Vercel git integration for preview deploys
- **CI containers:** GH Actions service containers mirror the Compose file (postgres, minio, redis) so e2e runs against the same wire-protocol stack as dev

### Environment variables

**Prod-only (set in Vercel):**

- `DATABASE_URL` — Vercel Postgres connection string
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — R2 credentials
- `S3_BUCKET_UPLOADS`, `S3_BUCKET_ASSETS`, `S3_PUBLIC_URL`
- `REDIS_URL` — Upstash TCP endpoint (`rediss://`)
- `SENTRY_DSN` (optional)

**Shared (starter):**

- `CIVITAI_CLIENT_ID`, `CIVITAI_CLIENT_SECRET`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`

### Out of scope (infra)

- Kubernetes — Compose for dev, Vercel for prod, neither needs orchestration
- Self-hosted prod DB / Redis — managed services free tier covers demo
- Background job queue (BullMQ, Inngest) — client polling against orchestrator is enough for MVP
- Custom image-resize service — Cloudflare Images / `next/image` covers it
- Multi-region failover — single Vercel region + single R2 jurisdiction for the demo

## Buzz economics (rough estimates)

| Action                                | Buzz cost  |
| ------------------------------------- | ---------- |
| Single image (Flux schnell)           | ~50        |
| Single image (Flux dev / SDXL)        | ~100-150   |
| Asset pack (7 stills)                 | ~700-1000  |
| Video clip (img2vid, 3-5s)            | ~500-1500  |
| Full pack (7 stills + 1 video + copy) | ~1500-2500 |
| VLM tagging (per photo)               | ~5-10      |

Starter session: ~2500 Buzz ≈ pocket change vs photoshoot.

## Hackathon demo flow

Pre-staged demo product (Civitai mug, team merch, or a vendor's actual product).

1. Sign in live with Civitai
2. Upload 5 product photos (drag-drop)
3. Watch VLM tags populate (~3s)
4. Pick: Audience = Millennials, Industry = Lifestyle/Drinkware, Goal = Launch, Channels = IG + Hero
5. Cost preview shows "~1200 Buzz" — confirm
6. Watch 7-tile grid render in parallel (~30-45s)

- Cl (phone-quality OK)
- **Optional:** paste website / Etsy / Shopify URL → we scrape for brand colors, tone, hero imagery
- **Optional:** brand name + 1-line description
- **VLM auto-tags** each photo (product type, dominant color, material, style cues)

Output: a lightweight "Brand Profile" — product catalog + extracted palette + tone descriptor. No model training. Stored on user account so they can return.

## Naming candidates

- ProductStudio
- BrandKit by Civitai
- Civitai Campaigns
- Pomelo (riff on Pomelli, citrus theme)
- ShelfReady
- Pitchforge
- Vitrine (French for storefront window)

## Build scope (1-week hackathon)

| Day | Milestone                                                     |
| --- | ------------------------------------------------------------- |
| 1   | Scaffold `next-app` starter, OAuth working, upload UI         |
| 2   | VLM tagging + brand profile state + persistence               |
| 3   | Target picker + prompt template library + cost preview        |
| 4   | Asset pack generator (parallel orchestrator submit + polling) |
| 5   | Result grid, regenerate-single, download flow                 |
| 6   | Video clip generation, LLM copy, polish UI                    |
| 7   | Demo prep, pre-stage product, dry runs                        |

## Out of scope (explicit)

- LoRA training (dropped per team feedback)
- Direct social-platform publishing (Meta / TikTok APIs require app approval)
- Multi-user team accounts
- Subscription billing layer (Buzz is the meter)
- Pomelli-style website scraping for brand DNA (stretch only)

## Open questions

- Which orchestrator workflows are pre-built vs need authoring this week?
- VLM access: is Florence-2 / BLIP exposed via orchestrator already, or do we need an interim path?
- LLM copy: which model do we route to via Civitai LLM client?
- Buzz pricing per tile: do we want a flat 'pack' price or per-tile transparent pricing?
- Aspect-ratio support per base model: do all support 9:16, 1:1, 16:9 cleanly?
- Do we want a free trial / discount for hackathon launch event?

## References

- [Create on-brand marketing content with Pomelli — Google blog](https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/)
- [Pomelli by Google Labs](https://labs.google.com/pomelli/about)
- [Get started with Pomelli — Google Labs Help](https://support.google.com/labs/answer/16715058?hl=en)
- [civitai-app-starters](https://github.com/civitai/civitai-app-starters)
