# Prompt-Lab Harness — Design

**Date:** 2026-06-12
**Status:** Approved design, pre-implementation
**Author:** Claude (pairing with Manuel)

## Problem

Campaign creatives from the orchestrator are inconsistent:

1. **Text not baked into the image.** The editor draws headline/subhead/CTA as an
   HTML/CSS overlay (`CreativeEditor.tsx:266-304`), but **export ships the raw
   orchestrator image** (`export/route.ts:46-71`) with no compositing. So the
   overlay is preview-only; the delivered asset has only the text the model
   actually rendered into pixels — which is often nothing.
2. **Cook vs regenerate inconsistency.** Cook prefers the wizard's pre-built
   `enhancedPrompts` verbatim (`cook/route.ts:107-117`); if those were built
   without copy directives, the model never receives them. Regenerate/fix-layout
   rebuilds fresh from `tile.adCopy` (`.../regenerate/route.ts:62-77`), injecting
   the copy directives — which is why text appears only after "fix layout".
3. **Fix-layout returns the original product image.** Regenerate sends the product
   reference (`images: refUrls`) to an edit-capable model with a weak hint
   (`[fix layout: improve composition…]`), so Nano Banana 2 lightly edits the
   reference and returns a near-copy of the input photo.

There is no fast way to change a prompt, run it against the **real** renderer, and
see what actually came back. MSW mocks (used by e2e) return fake images, useless
for judging quality. Iterating through the full app UI is slow, and a screenshot
of the editor canvas is actively misleading: it shows the HTML overlay text, not
what the model baked into pixels.

## Decisions (locked)

- **Text strategy: baked into pixels by the model.** The loop tunes the prompt
  until Nano Banana 2 renders legible, correctly-spelled, on-brand text. Export
  already ships baked pixels; the overlay stays as preview only.
- **Harness: a prompt-lab CLI script.** It judges the **raw orchestrator image**,
  not the canvas. Playwright is reserved only for reproducing the two UI bugs.
- **Cost: no guard.** Dev Buzz is effectively free. Each run estimates only to
  record cost in `meta.json`; there is no abort gate.
- **Auth: paste the sealed `civ_session` cookie into `.env`** (`PROMPT_LAB_SESSION`).
  No login script / handshake; the script unseals it and self-refreshes.

## Goals

- A tight loop: change `promptBuilder.ts` → run against the real orchestrator →
  download raw images → judge against a fixed rubric → repeat.
- Tune the **exact prompt code that ships** (import the real `promptBuilder`), so
  improvements land in production, not in a fork.
- Sweep briefs × presets to verify **consistency**, not one lucky generation.

## Non-Goals

- Export compositor (rejected: text is baked in).
- Photoshoot prompt tuning (can extend `fixtures.ts` + a `--mode photoshoot` later).
- Automated LLM scorer (Claude is the multimodal judge for v1).
- Any change to the user-facing app surface (no new routes/components).

## Architecture

### File layout

```
scripts/prompt-lab/
  run.ts        # build prompt → estimate → submit → poll → download → meta.json
  auth.ts       # resolve a fresh access token from the pasted session cookie
  fixtures.ts   # sample briefs + brand profiles + reference image URLs
  runs/         # gitignored output: <ts>-<preset>/{01.png, …, meta.json, verdict.md}
```

`.auth/` and `runs/` are already covered by `.gitignore` (`.auth/` line 10; add
`scripts/prompt-lab/runs/`).

### Shared-code refactor

`scripts/run.ts` must build the orchestrator body the same way the app does, but
`src/lib/civitai.ts` starts with `import 'server-only'` and cannot be imported by
a plain script.

- Extract into a new **`src/lib/imageGenBody.ts`** (no `server-only`):
  `DEFAULT_IMAGE_ENGINE`, `DEFAULT_IMAGE_MODEL`, `VitrineImageGenInput`,
  `buildVitrineImageGenBody`.
- `civitai.ts` imports and re-exports these (no behavior change for the app).
- `run.ts` imports the **real** `promptBuilder.ts` + `imageGenBody.ts`, plus the
  SDK orchestrator client directly (`createOrchestratorClient`,
  `estimateWorkflow`, `submitWorkflow`, `getWorkflow`/`pollWorkflow`,
  `extractImageUrls`, `isTerminal`). No `server-only` in its import graph.

Scripts use **relative imports** (`../../src/lib/promptBuilder`) to avoid `@/`
alias resolution under tsx.

### Auth

- The app already submits to the prod orchestrator (`https://orchestration.civitai.com`)
  with a token minted by the local civitai dev server (`CIVITAI_BASE_URL=:3000`).
  The lab does the same.
- **No headless login handshake.** Manuel logs into the app once, copies the
  sealed `civ_session` cookie from browser devtools (Application → Cookies →
  `civ_session`; httpOnly hides it from JS, not from the devtools panel), and
  pastes it into `.env` as `PROMPT_LAB_SESSION=<sealed value>`. The sealed cookie
  already contains `{access_token, refresh_token, expires_at}`.
- `auth.ts` resolves a usable access token on every run:
  1. `unsealCookie(process.env.PROMPT_LAB_SESSION, SESSION_SECRET)` → tokens.
  2. If `expires_at` is within 30s, `oauthRefresh({ baseUrl: CIVITAI_BASE_URL,
     clientId, clientSecret, refreshToken })` → fresh tokens; cache them to
     `.auth/prompt-lab.json` so subsequent runs keep working after the pasted
     cookie's access token expires (30-day refresh TTL → re-paste ~monthly).
  3. On refresh failure (stale cookie), exit with a clear "re-paste
     PROMPT_LAB_SESSION from devtools" message.
- **Fallback:** `PROMPT_LAB_ACCESS_TOKEN=<raw>` is honored if set, used as-is with
  no refresh (dies on expiry — quick probes only).
- `PROMPT_LAB_SESSION` / `PROMPT_LAB_ACCESS_TOKEN` are **script-only** vars read
  via `process.env` directly; they are not part of the app's `src/lib/env.ts`
  schema (the app never reads them). Documented in `.env.example` under a
  prompt-lab section.

### Runner

- Add `tsx` as a devDependency.
- `package.json` script: `"prompt-lab": "node --env-file=.env --import tsx scripts/prompt-lab/run.ts"`
  (mirrors the existing `node --env-file=.env` convention). No separate login
  script — auth resolves from `PROMPT_LAB_SESSION` on every run.

## `run.ts` contract

**Flags**

| Flag | Meaning |
|---|---|
| `--brief <key>` | fixture key from `fixtures.ts` (or inline JSON via `--brief-json`) |
| `--preset <ids>` | comma list, e.g. `ig-feed,ig-story` (default: `ig-feed`) |
| `--brand <key>` | fixture brand profile (default: the brief's brand) |
| `--refs <urls>` | comma list of reference image URLs (optional) |
| `--prompt-override <s>` | bypass builder, send raw prompt (for quick probes) |
| `--negative-override <s>` | raw negative prompt |
| `--num <n>` | images per preset (default 1) |
| `--matrix` | sweep all fixture briefs × the given presets |

**Flow (per preset)**

1. `buildCampaignPrompt({ brief, brand, preset, referenceCount, adCopy })` — the
   real builder. `adCopy` comes from the fixture (so copy directives are exercised).
2. `estimateWorkflow(...)` → record `cost.total` (informational; no gate).
3. `submitWorkflow(...)` → `workflowId`.
4. Poll to terminal (`pollWorkflow` / loop on `getWorkflow` + `isTerminal`).
5. `extractImageUrls(snapshot)` → download each to
   `runs/<ts>-<preset>/NN.png`.
6. Write `meta.json`: `{ preset, finalPrompt, negativePrompt, aspectRatio,
   adCopy, refs, cost, workflowId, imageUrls, status }`.
7. Print the local PNG paths.

## Tuning loop + rubric

Claude runs `prompt-lab`, then `Read`s the PNGs (true pixels) and scores each
against a fixed rubric so iterations are comparable:

1. Headline present, legible, **correctly spelled**.
2. Subhead present + legible.
3. CTA text correct (when present).
4. Product fidelity preserved (silhouette, label, material).
5. Brand palette / tone match.
6. Correct aspect ratio for the preset.
7. No garbled, extra, or duplicate text.

Verdict (pass/fail per criterion + a one-line hypothesis for the next change)
written to `runs/<ts>/verdict.md`. Then edit `promptBuilder.ts`, rerun, compare.

**Stop condition (loop-until-consistent):** the rubric passes across the matrix
for the target presets on consecutive briefs — not a single good run. A failure
that reproduces across briefs becomes the next hypothesis.

## Known-issues backlog (enabled by the harness, fixed after the prompt is solid)

1. **Cook vs regenerate text inconsistency** (`cook/route.ts`): make cook inject
   copy directives whenever `adCopy` is present, instead of trusting a
   client-supplied `enhancedPrompts` that may lack them. The lab validates the
   prompt; this aligns the cook path with regenerate.
2. **Fix-layout original-image bug** (`.../regenerate/route.ts`): the hint +
   reference handling yields a near-copy of the product photo. Use the lab to find
   a regenerate prompt/strength that re-composes rather than lightly edits; also
   verify `extractImageUrls` is not surfacing input images.

## Risks / open questions

- **Stale pasted cookie.** When the refresh token finally expires (~30 days) or
  Manuel logs out, refresh fails. Mitigation: clear exit message telling him to
  re-paste `PROMPT_LAB_SESSION` from devtools.
- **Dev-server token vs prod orchestrator.** Assumed valid because the app already
  works this way; if the lab gets 401s from the orchestrator, the token audience
  is wrong — first probe to run before building the full loop.
- **Reference images dominate output.** Nano Banana 2 weights refs heavily; runs
  with and without `--refs` will be compared so the rubric separates "prompt is
  wrong" from "ref is overpowering the scene."

## Verification

- `pnpm typecheck` after the `imageGenBody.ts` extraction (app must be unchanged
  in behavior).
- With `PROMPT_LAB_SESSION` pasted, `prompt-lab --preset ig-feed` reaches the
  orchestrator (no 401), produces a real PNG in `runs/` that Claude can `Read`,
  and writes `meta.json` with a non-zero cost.
- App e2e/unit suites stay green (the refactor is import-only).
