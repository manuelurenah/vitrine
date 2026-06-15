# Photoshoot Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the photoshoot flow with campaigns — a shared prompt composer + LLM draft that improves the prompt and preselects styles, inline-editable per-style review, a 16:9 ratio, a campaign-style details page, and a smarter grid.

**Architecture:** Reuse the campaign `PromptComposer` (generalized with a `destination` prop) on the `/photoshoot` grid; `/photoshoot/new` reads `?prompt&refs`, calls a new `/api/photoshoot/draft` (mirroring `/api/campaigns/draft`), and prefills a restructured wizard (`configure → review`). The photoshoot brief keeps its shape: the LLM's improved prompt maps to `productNotes`, a new free-text `title` rides alongside. The details page is rebuilt to the campaign row layout (one row per style/template, horizontal variant images). No DB schema change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3.4, Zod, Drizzle, OpenRouter (via OpenAI SDK), Vitest (unit), Playwright + MSW (e2e).

---

## Conventions for every task

- Verify TS after any `src/` change: `pnpm typecheck`.
- Unit tests use **Vitest** (`*.test.ts` beside source, e.g. `src/lib/assets.test.ts`). Run a single file: `pnpm vitest run <path>`.
- Commit after each task with the message shown. Work happens on branch `feat/photoshoot-revamp` (already created).
- Do NOT touch the pre-existing uncommitted changes in `src/lib/assets.ts`, `src/lib/assets.test.ts`, `src/lib/s3.ts` — leave them in the working tree, don't stage them.
- Caveman prose in chat is fine, but **all code, comments, and commit messages are normal English.**

---

## File Structure

**Modify**
- `src/components/photoshoot/PhotoshootList.tsx` — step label, grid columns, render `PromptComposer`.
- `src/lib/photoshoots.ts` — round-robin cover thumbnails.
- `src/lib/photoshootTemplates.ts` — improved `styleNotes`, add `'16:9'` to `PhotoshootRatio`.
- `src/lib/photoshootSchema.ts` — add `'16:9'` to brief `ratio` enum.
- `src/app/api/photoshoot/preview/route.ts` — add `'16:9'` to local brief enum.
- `src/app/api/photoshoot/cook/route.ts` — add `'16:9'` to `enhancedPromptSchema.aspectRatio`; accept a `title`; keep image delivery.
- `src/components/campaigns/PromptComposer.tsx` — generalize with `destination`/`buttonLabel`/`placeholder`.
- `src/app/(app)/photoshoot/new/page.tsx` — parse `?prompt&refs` (and keep legacy `?subject`).
- `src/components/photoshoot/PhotoshootWizard.tsx` — restructured `configure → review` flow, draft auto-call, master prompt, free name, read-only product/refs, live estimate.
- `src/components/photoshoot/PhotoshootResults.tsx` — campaign-style rows, remove badge/middle-text/bulk-bar.

**Create**
- `src/lib/photoshoots.coverThumbs.test.ts` — unit test for the cover helper (or colocate in an existing test file — see Task 3).
- `src/lib/photoshootDraft.ts` — `generatePhotoshootDraft` (LLM).
- `src/lib/photoshootDraft.test.ts` — fallback unit test.
- `src/app/api/photoshoot/draft/route.ts` — draft endpoint.
- `src/components/photoshoot/PhotoshootResultRow.tsx` — one style row + per-variant menu.

**Tests touched**
- `e2e/60-photoshoot.spec.ts`, `e2e/55-photoshoot-cross-flow.spec.ts`, `e2e/61-photoshoot-regenerate.spec.ts`, `e2e/65-photoshoot-subject.spec.ts`, `src/mocks/handlers.ts`.

---

## Phase 1 — Surgical grid + ratio changes (independent, low risk)

### Task 1: Grid step label

**Files:** Modify `src/components/photoshoot/PhotoshootList.tsx:50`

- [ ] **Step 1: Change the eyebrow text**

In `PhotoshootList.tsx`, line 50, change:
```tsx
<span className="t-eyebrow">// step 2 · shoot</span>
```
to:
```tsx
<span className="t-eyebrow">// step 1 · shoot</span>
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/photoshoot/PhotoshootList.tsx
git commit -m "fix(photoshoot): label grid as step 1"
```

### Task 2: Grid at most 4 columns

**Files:** Modify `src/components/photoshoot/PhotoshootList.tsx:125`

- [ ] **Step 1: Widen the grid**

Change line 125 from:
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```
to:
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

- [ ] **Step 2: Verify** — `pnpm typecheck` (no errors).
- [ ] **Step 3: Commit**
```bash
git add src/components/photoshoot/PhotoshootList.tsx
git commit -m "feat(photoshoot): allow up to 4 columns on the grid"
```

### Task 3: Cover collage fills from all shots (round-robin)

**Files:**
- Modify `src/lib/photoshoots.ts` (the `listPhotoshoots` thumbnail aggregation around lines 195-219; `firstSnapshotImage` at 267-275)
- Test: `src/lib/photoshoots.coverThumbs.test.ts` (new)

Context: today each tile contributes exactly one thumbnail (its linked asset URL or the first snapshot image), capped at 4 in tile-creation order. A 1-shot/4-variant shoot therefore shows only 1 cover image. Fix: gather **all** images per tile and round-robin across tiles to fill up to 4 slots.

- [ ] **Step 1: Write the failing test**

Create `src/lib/photoshoots.coverThumbs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickCoverThumbs } from './photoshoots';

describe('pickCoverThumbs', () => {
  it('takes up to 4 images from a single shot', () => {
    expect(pickCoverThumbs([['a', 'b', 'c', 'd', 'e']])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('round-robins one image per shot across many shots', () => {
    const out = pickCoverThumbs([
      ['s1a', 's1b', 's1c'],
      ['s2a', 's2b', 's2c'],
      ['s3a', 's3b', 's3c'],
      ['s4a', 's4b', 's4c'],
    ]);
    expect(out).toEqual(['s1a', 's2a', 's3a', 's4a']);
  });

  it('fills remaining slots with later images when shots are few', () => {
    expect(pickCoverThumbs([['a1', 'a2'], ['b1']])).toEqual(['a1', 'b1', 'a2']);
  });

  it('skips empty shots and returns fewer than 4 when exhausted', () => {
    expect(pickCoverThumbs([[], ['b1'], []])).toEqual(['b1']);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm vitest run src/lib/photoshoots.coverThumbs.test.ts`
Expected: FAIL — `pickCoverThumbs` is not exported.

- [ ] **Step 3: Implement `pickCoverThumbs` and `allSnapshotImages`**

In `src/lib/photoshoots.ts`, add the exported helper (place near `firstSnapshotImage`):
```ts
/**
 * Round-robin across shots (each inner array is one shot's ordered images),
 * taking one image per shot per pass until `max` is filled or all exhausted.
 * 1 shot × N variants → up to `max` from that shot; M shots → one per shot first.
 */
export function pickCoverThumbs(imagesByShot: string[][], max = 4): string[] {
  const out: string[] = [];
  let pass = 0;
  let tookSomething = true;
  while (out.length < max && tookSomething) {
    tookSomething = false;
    for (const shot of imagesByShot) {
      if (out.length >= max) break;
      const url = shot[pass];
      if (url) {
        out.push(url);
        tookSomething = true;
      }
    }
    pass++;
  }
  return out;
}

function allSnapshotImages(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  try {
    return extractImageUrls(snapshot as WorkflowSnapshot);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm vitest run src/lib/photoshoots.coverThumbs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into `listPhotoshoots`**

Replace the thumbnail aggregation loop (currently lines ~207-219). The goal: build `imagesByShot: Map<photoshootId, string[][]>` where each inner array is one tile's images (prefer all snapshot images; fall back to the single linked asset URL), then compute `thumbsByShoot` via `pickCoverThumbs`. New loop:
```ts
  const tilesByShoot = new Map<string, PhotoshootTileRow[]>();
  const imagesByShoot = new Map<string, string[][]>();
  for (const { tile, assetPublicUrl, snapshot } of tileRows) {
    const tileBucket = tilesByShoot.get(tile.photoshootId) ?? [];
    tileBucket.push(tile);
    tilesByShoot.set(tile.photoshootId, tileBucket);

    const snapImages = allSnapshotImages(snapshot);
    const tileImages = snapImages.length > 0 ? snapImages : assetPublicUrl ? [assetPublicUrl] : [];
    if (tileImages.length > 0) {
      const shotBucket = imagesByShoot.get(tile.photoshootId) ?? [];
      shotBucket.push(tileImages);
      imagesByShoot.set(tile.photoshootId, shotBucket);
    }
  }
  return rows.map((r) =>
    toPhotoshoot(r, tilesByShoot.get(r.id) ?? [], pickCoverThumbs(imagesByShoot.get(r.id) ?? [])),
  );
```
Keep the now-unused `firstSnapshotImage` only if nothing else references it; otherwise delete it (grep first: `grep -rn firstSnapshotImage src`). Confirm `extractImageUrls` and `WorkflowSnapshot` are already imported at the top of the file (they are — `firstSnapshotImage` uses them).

- [ ] **Step 6: Verify** — `pnpm typecheck` and `pnpm vitest run src/lib/photoshoots.coverThumbs.test.ts` both green.
- [ ] **Step 7: Commit**
```bash
git add src/lib/photoshoots.ts src/lib/photoshoots.coverThumbs.test.ts
git commit -m "feat(photoshoot): fill cover collage from all shots and variants"
```

### Task 4: Add 16:9 ratio to the type + improve style prompts

**Files:** Modify `src/lib/photoshootTemplates.ts`

- [ ] **Step 1: Add `'16:9'` to `PhotoshootRatio`**

Line 10:
```ts
export type PhotoshootRatio = '1:1' | '4:5' | '9:16' | '16:9';
```

- [ ] **Step 2: Rewrite the 7 `styleNotes` for stronger, consistent results**

Keep every `id`, `label`, `group`, `defaultOn` unchanged. Replace only the `styleNotes` strings. Each should name framing, lighting, background/setting, lens/DoF, and a quality clause, concise:
```ts
  'studio-clean': {
    // ...
    styleNotes:
      'clean studio product photograph, seamless light-grey paper backdrop, soft diffused key light with gentle fill, subtle contact shadow, centered hero framing, 50mm lens, crisp focus edge to edge, ecommerce ready, no props',
  },
  'studio-dark': {
    // ...
    styleNotes:
      'dramatic studio product photograph, deep charcoal gradient backdrop, single hard rim light plus soft fill, controlled specular highlights, moody low-key mood, 85mm lens, sharp product detail, premium look',
  },
  'lifestyle-kitchen': {
    // ...
    styleNotes:
      'lifestyle product photograph on a warm wooden kitchen counter, soft natural window daylight, a hand reaching for the product, shallow depth of field, candid editorial framing, realistic textures',
  },
  'lifestyle-market': {
    // ...
    styleNotes:
      'lifestyle product photograph at an outdoor farmers market, wooden crates and fresh produce around the product, bright directional sunlight, contextual placement, 35mm reportage feel, natural color',
  },
  'lifestyle-handheld': {
    // ...
    styleNotes:
      'lifestyle product photograph of the product held in use, hands in frame, blurred everyday background, shallow depth of field, natural daylight, authentic editorial moment',
  },
  'lifestyle-flatlay': {
    // ...
    styleNotes:
      'overhead flatlay product photograph, the product centered on a linen surface with complementary props arranged around it, even soft daylight from above, balanced negative space, top-down 90-degree angle',
  },
  'hero-wide': {
    // ...
    styleNotes:
      'wide cinematic hero product photograph, the product anchored to one side with generous negative space for copy on the other, soft cinematic key light, gentle gradient backdrop, shallow depth of field, banner-ready composition',
  },
```

- [ ] **Step 3: Verify** — `pnpm typecheck`. (Type change to `PhotoshootRatio` will surface follow-on enum gaps; those are fixed in Task 5.) If typecheck flags only the ratio enums in `photoshootSchema.ts`/preview/cook, that's expected — proceed; Task 5 closes them. If it flags anything else, stop and report.
- [ ] **Step 4: Commit**
```bash
git add src/lib/photoshootTemplates.ts
git commit -m "feat(photoshoot): add 16:9 ratio type and improve style prompts"
```

### Task 5: Thread 16:9 through schemas and the wizard ratio control

**Files:**
- Modify `src/lib/photoshootSchema.ts` (the shared `photoshootBriefSchema` `ratio` enum)
- Modify `src/app/api/photoshoot/preview/route.ts:22` (local `photoshootBriefSchema` `ratio` enum)
- Modify `src/app/api/photoshoot/cook/route.ts:26` (`enhancedPromptSchema.aspectRatio` enum)
- Modify the ratio chips in `src/components/photoshoot/PhotoshootWizard.tsx` (currently the `4:5 · 9:16 · 1:1` chip group ~lines 644-655)

- [ ] **Step 1: Update the three Zod enums**

In each location change `z.enum(['1:1', '4:5', '9:16'])` → `z.enum(['1:1', '4:5', '9:16', '16:9'])`. (In `photoshootSchema.ts` it's the brief `ratio`; in preview route the local `photoshootBriefSchema.ratio`; in cook route `enhancedPromptSchema.aspectRatio`.) Grep to be sure you got them all: `grep -rn "'9:16'" src/lib/photoshootSchema.ts src/app/api/photoshoot`.

- [ ] **Step 2: Add the 16:9 ratio chip in the wizard**

In `PhotoshootWizard.tsx`, find the ratio chip group (renders `4:5`, `9:16`, `1:1` via `<Chip>`). Add a `16:9` option to the same control so the rendered set is `1:1 · 4:5 · 9:16 · 16:9`. Match the existing chip markup/handler exactly (read the surrounding lines first). If the ratios are sourced from a local array (e.g. `const RATIOS = [...]`), add `'16:9'` to it.

- [ ] **Step 3: Verify** — `pnpm typecheck` (now fully green, including Task 4's type change).
- [ ] **Step 4: Commit**
```bash
git add src/lib/photoshootSchema.ts src/app/api/photoshoot/preview/route.ts src/app/api/photoshoot/cook/route.ts src/components/photoshoot/PhotoshootWizard.tsx
git commit -m "feat(photoshoot): accept 16:9 ratio across schemas and wizard"
```

---

## Phase 2 — LLM draft (improve prompt + preselect styles)

### Task 6: `generatePhotoshootDraft`

**Files:**
- Create `src/lib/photoshootDraft.ts`
- Test: `src/lib/photoshootDraft.test.ts`

Mirror `generateCampaignDraft` (`src/lib/adCopy.ts`) structure: OpenRouter client via OpenAI SDK, model fallback chain, JSON mode with prose fallback, transient retry, and a local fallback when the API key is missing or all models fail. Read `src/lib/adCopy.ts` first to reuse its helpers — in particular `resolveModels`, `parseJson`, `isTransientError`, and `clampField` if exported; if they are NOT exported, do not export them just for this — replicate the small pieces you need locally in `photoshootDraft.ts` (keep it self-contained, DRY within the file).

Output contract:
```ts
import type { BrandProfile } from './brand';
import { PHOTOSHOOT_TEMPLATES, recommendedTemplateIds, type PhotoshootTemplateId } from './photoshootTemplates';

export type PhotoshootDraft = {
  title: string;
  prompt: string; // improved photoshoot prompt (becomes productNotes)
  templateIds: PhotoshootTemplateId[]; // preselected styles, subset of the 7 known ids
};

export type PhotoshootDraftMeta = {
  llm: 'ok' | 'fallback';
  model?: string;
  attempts?: string[];
  reason?: string;
};

export type GeneratePhotoshootDraftInput = {
  prompt: string;
  brand?: BrandProfile | null;
  productName?: string;
  referenceCount?: number;
  signal?: AbortSignal;
};

export type PhotoshootDraftResult = { draft: PhotoshootDraft; meta: PhotoshootDraftMeta };
```

Fallback (no key / all models fail): `{ title: input.productName?.trim() || 'Photoshoot', prompt: input.prompt.trim(), templateIds: recommendedTemplateIds() }`.

The LLM prompt must:
- give the model the available templates as `id — label — styleNotes` (build from `PHOTOSHOOT_TEMPLATES`),
- ask it to return JSON `{ "title": string, "prompt": string, "templateIds": string[] }` where `prompt` is an improved, concrete product-photography brief and `templateIds` are 1-4 best-fit ids drawn ONLY from the supplied ids,
- include brand DNA (name/industry/tone/tagline) and reference-image count for context.

Validation when parsing the completion: clamp `title` (≤120 chars, fallback to productName/'Photoshoot'), clamp `prompt` (≤2000 chars, fallback to the user prompt), and filter `templateIds` through `PHOTOSHOOT_TEMPLATES` / drop unknowns; if the filtered list is empty, use `recommendedTemplateIds()`. Treat empty/non-JSON/unrecognised-shape as "advance the chain", exactly like `generateCampaignDraft`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/photoshootDraft.test.ts` (covers the key-missing fallback, which needs no network):
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('generatePhotoshootDraft fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a template fallback when OPENROUTER_API_KEY is unset', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const { generatePhotoshootDraft } = await import('./photoshootDraft');
    const { draft, meta } = await generatePhotoshootDraft({
      prompt: 'cozy candle on a desk',
      productName: 'Amber Candle',
    });
    expect(meta.llm).toBe('fallback');
    expect(draft.prompt).toContain('cozy candle');
    expect(draft.title).toBe('Amber Candle');
    expect(draft.templateIds.length).toBeGreaterThan(0);
    // every returned id is a real template
    for (const id of draft.templateIds) {
      expect(id in (await import('./photoshootTemplates')).PHOTOSHOOT_TEMPLATES).toBe(true);
    }
  });
});
```
> Note on env: `src/lib/env.ts` validates env via Zod. If `generatePhotoshootDraft` reads `env.OPENROUTER_API_KEY` (like `adCopy.ts`), `vi.stubEnv` before importing the module should suffice because the module reads env lazily. If the test cannot stub env cleanly (mirrors however `adCopy` is/ isn't unit-tested), instead assert the fallback by checking `adCopy.ts` patterns — read whether an `adCopy.test.ts` exists and follow its setup. Keep the test deterministic and network-free.

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm vitest run src/lib/photoshootDraft.test.ts`
Expected: FAIL — module/function does not exist.

- [ ] **Step 3: Implement `src/lib/photoshootDraft.ts`** per the contract above.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm vitest run src/lib/photoshootDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify + Commit**
```bash
pnpm typecheck
git add src/lib/photoshootDraft.ts src/lib/photoshootDraft.test.ts
git commit -m "feat(photoshoot): LLM draft to improve prompt and preselect styles"
```

### Task 7: `POST /api/photoshoot/draft`

**Files:** Create `src/app/api/photoshoot/draft/route.ts`

Mirror `src/app/api/campaigns/draft/route.ts` exactly (auth, Zod parse, resolve reference count via `getPublicUrls` with `MissingReferenceError` handling, call the lib fn, return JSON).

- [ ] **Step 1: Implement the route**
```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { generatePhotoshootDraft } from '@/lib/photoshootDraft';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const draftSchema = z.object({
  prompt: z.string().min(1).max(2000),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  productName: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = draftSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const { prompt, referenceAssetIds, productName } = parsed.data;

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  let referenceCount = 0;
  try {
    if (referenceAssetIds.length > 0) {
      referenceCount = (await getPublicUrls(userKey, referenceAssetIds)).length;
    }
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const { draft, meta } = await generatePhotoshootDraft({ prompt, brand, referenceCount, productName });
  return NextResponse.json({ draft, meta });
}
```

- [ ] **Step 2: Verify + Commit**
```bash
pnpm typecheck
git add src/app/api/photoshoot/draft/route.ts
git commit -m "feat(photoshoot): add /api/photoshoot/draft route"
```

### Task 8: MSW mock for the draft endpoint

**Files:** Modify `src/mocks/handlers.ts`

Context: e2e runs with `MOCK_CIVITAI=1`; MSW intercepts external Civitai/orchestrator calls. The draft route calls OpenRouter, which is external. Add a handler so the draft endpoint is deterministic in e2e. Read `src/mocks/handlers.ts` first to match the existing handler style and confirm whether OpenRouter is already mocked for the campaign draft (search for `openrouter`, `chat/completions`, `OPENROUTER_BASE_URL`).

- [ ] **Step 1: Add/extend the OpenRouter completions handler**

If a `*/chat/completions` handler already exists for campaigns, extend it to also return a valid photoshoot-draft JSON shape when the system/user prompt indicates a photoshoot (or simply have it return JSON containing both campaign and photoshoot keys — extra keys are ignored by each parser). If none exists, add one that returns:
```json
{ "choices": [ { "message": { "content": "{\"title\":\"Mock Shoot\",\"prompt\":\"studio shot of the product, clean lighting\",\"templateIds\":[\"studio-clean\",\"lifestyle-handheld\"]}" } } ] }
```
Match the route/method the OpenAI SDK uses against `OPENROUTER_BASE_URL` (typically `POST {base}/chat/completions`).

- [ ] **Step 2: Verify + Commit**
```bash
pnpm typecheck
git add src/mocks/handlers.ts
git commit -m "test(photoshoot): mock OpenRouter draft for e2e"
```

---

## Phase 3 — Compose entry + restructured wizard

### Task 9: Generalize `PromptComposer`

**Files:** Modify `src/components/campaigns/PromptComposer.tsx`; caller `src/components/campaigns/CampaignsList.tsx:70` stays working via defaults.

- [ ] **Step 1: Add destination/label props**

Change the `Props` type and `handleSubmit`:
```tsx
type Props = {
  placeholder?: string;
  destination?: string; // route to push to with ?prompt&refs
  buttonLabel?: string;
};

export function PromptComposer({
  placeholder = 'describe the campaign you want to cook',
  destination = '/campaigns/new',
  buttonLabel = 'generate brief',
}: Props) {
```
In `handleSubmit`, replace the hardcoded route:
```tsx
    router.push(`${destination}?${params.toString()}`);
```
And the submit button label:
```tsx
          >
            {buttonLabel}
          </Button>
```

- [ ] **Step 2: Verify** — `pnpm typecheck`. Campaign usage (`<PromptComposer />`) compiles unchanged.
- [ ] **Step 3: Commit**
```bash
git add src/components/campaigns/PromptComposer.tsx
git commit -m "refactor(composer): parameterize PromptComposer destination and label"
```

### Task 10: Render PromptComposer on the photoshoot grid

**Files:** Modify `src/components/photoshoot/PhotoshootList.tsx`

Replace the existing "new photoshoot" hero CTA card (lines ~57-102) with the shared composer, keeping the surrounding gradient/header. Import it: `import { PromptComposer } from '@/components/campaigns';`

- [ ] **Step 1: Swap the hero card for the composer**

Render, in place of the hero CTA card block:
```tsx
        <div className="mx-auto mt-8 max-w-[720px]">
          <PromptComposer
            destination="/photoshoot/new"
            buttonLabel="design shoot"
            placeholder="describe the photoshoot you want — product, vibe, setting"
          />
        </div>
```
Keep the "just want to edit or generate a single image?" helper row and the `past photoshoots` section as-is. The mobile `FAB` to `/photoshoot/new` stays.

- [ ] **Step 2: Verify** — `pnpm typecheck`.
- [ ] **Step 3: Commit**
```bash
git add src/components/photoshoot/PhotoshootList.tsx
git commit -m "feat(photoshoot): launch new shoots from the shared prompt composer"
```

### Task 11: `/photoshoot/new` reads `?prompt&refs` (keep legacy `?subject`)

**Files:** Modify `src/app/(app)/photoshoot/new/page.tsx`

- [ ] **Step 1: Parse prompt + refs; map legacy subject into refs**

Add a `parseRefs` helper (copy the campaign one — `product:`/`asset:` prefixed, slice 4). Read `prompt` and `refs` from `searchParams`. Keep parsing `subject`; when present and valid, fold it into the refs list as `${kind}:${id}` so the wizard treats the deep-linked product/asset as a selected reference. Pass new props to the wizard: `prompt` (string | null) and `referenceAssetIds` (string[]). Keep `buzzBalance`, `libraryAssets`, `libraryProducts`. You may drop `defaultSubject` once the wizard no longer uses it (Task 12), or keep passing it through one extra step and remove in Task 12 — your call, but leave the build green at every commit.

Example additions:
```tsx
function parseRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim())
    .filter((id) => id.startsWith('product:') || id.startsWith('asset:')).slice(0, 4);
}
// ...inside the component, after resolving session/userKey:
const promptParam = firstString(sp.prompt)?.trim() ?? null;
const refs = parseRefs(firstString(sp.refs));
const subject = parseSubjectParam(firstString(sp.subject));
const refsWithSubject = subject ? Array.from(new Set([...refs, `${subject.kind}:${subject.id}`])) : refs;
```
Render `<PhotoshootWizard prompt={promptParam} referenceAssetIds={refsWithSubject} buzzBalance={...} libraryAssets={...} libraryProducts={...} />`.

- [ ] **Step 2: Verify** — `pnpm typecheck` (the wizard prop types change in Task 12; if this task lands first and typecheck fails on the new props, do Task 11 and Task 12 in one combined commit — they are tightly coupled).
- [ ] **Step 3: Commit** (may be combined with Task 12)
```bash
git add "src/app/(app)/photoshoot/new/page.tsx"
git commit -m "feat(photoshoot): pass prompt and refs from composer into the wizard"
```

### Task 12: Restructure the wizard — configure → review, draft, master prompt, free name, estimate

**Files:** Modify `src/components/photoshoot/PhotoshootWizard.tsx`

This is the largest task. **Read the entire current `PhotoshootWizard.tsx` first.** Preserve everything that still applies (template chips, variants stepper, the preview/estimate plumbing against `/api/photoshoot/preview`, the per-template review cards). The changes:

1. **Props** — new shape:
   ```tsx
   type Props = {
     prompt?: string | null;
     referenceAssetIds?: string[];
     buzzBalance?: number | null;
     libraryAssets: Asset[];
     libraryProducts: Product[];
   };
   ```
   Remove `defaultSubject` and the `Subject`/`SubjectPanel`/`ProductRadioList`/`resolveSubjectReference` machinery — the product + references now arrive pre-selected via `referenceAssetIds` (`product:`/`asset:` prefixed).

2. **Step machine** — `configure → review → submit` (drop the old `brief` template-first step). If `prompt` is provided, on mount call `POST /api/photoshoot/draft` with `{ prompt, referenceAssetIds, productName }` (productName = the selected product's name, resolved from `libraryProducts` + the `product:` ref if any). While the draft is in flight, show a brief loading state on the configure step. Seed state from the draft: `title` ← `draft.title`, master prompt (`productNotes`) ← `draft.prompt`, selected `templateIds` ← `draft.templateIds`. If no `prompt` prop (user hit "start"/FAB directly), start on configure with empty master prompt and `recommendedTemplateIds()` preselected, no draft call.

3. **Configure step UI** (replaces the old brief step; mirrors `image copy.png`):
   - **Read-only product + references**: resolve `referenceAssetIds` to thumbnails using `libraryProducts` (match `product:<id>` → product hero) and `libraryAssets` (match `asset:<id>` → asset url). Render small thumbnails, not editable. Label which is the product.
   - **Name**: a text `<input>` bound to `title`, fully editable, **independent of product name**. (Use the existing `Field`/input components in the file.)
   - **Prompt**: a `<textarea>` bound to the master prompt (`productNotes`), prefilled from the draft, editable.
   - **Styles**: the existing template chips, with `templateIds` preselected; user toggles. Use the improved `styleNotes` (already done in Task 4).
   - **Ratio**: chips incl `16:9` (Task 5).
   - **Variants**: existing stepper.
   - **Live Buzz estimate**: call `/api/photoshoot/preview` (debounced) whenever master prompt / styles / ratio / variants change; show the total as a `BuzzPill`. The brief sent to preview is `{ productName, productNotes: masterPrompt, ratio, variantsPerTemplate, templateIds }` with `referenceAssetIds`. Reuse the wizard's existing preview hook/logic if present; otherwise debounce a `fetch`.
   - Primary button → go to review.

4. **Review step UI** (mirrors `image copy 3.png`, fixes the per-style bug):
   - Render **one card per selected `templateId`** (iterate `templateIds`, not template groups). Each card's eyebrow = that template's `label` (e.g. `// studio · clean`). This fixes "selected three styles, only two shown" — the previous grouping by `template.group` collapsed multiple lifestyle styles into one card.
   - Each card's final prompt is an **always-editable `<textarea>`** (no `+ edit raw prompt` toggle). Editing sets that template's `userOverride` in the `enhancedPrompts` map. Keep the "show what we added from your brand" expander as a read-only disclosure.
   - Show the live total `BuzzPill`.
   - Cook button → `POST /api/photoshoot/cook` with `{ productName, productNotes, ratio, variantsPerTemplate, templateIds, title, referenceAssetIds, enhancedPrompts }`.

5. **Cook payload `title`** — include the free-text `title` in the cook request body (consumed in Task 13).

Implementation guidance:
- Keep `productName` populated (it feeds `buildPhotoshootPrompt`'s base): set it to the selected product's name, or `'product'` if only loose assets were chosen. Never leave it empty (the brief schema requires `min(1)`).
- `productNotes` is required `min(1)` in the schema — guard the cook/preview calls so they only fire once the master prompt is non-empty; disable the cook button otherwise.
- Reuse existing components in the file (`Chip`, `Field`, `BuzzPill`, the review card, the preview hook). Do not rebuild what's there; restructure the step flow and swap the data source for prompt/name.

- [ ] **Step 1: Implement the restructure** per the above. Delete the now-dead subject machinery.
- [ ] **Step 2: Verify** — `pnpm typecheck` green.
- [ ] **Step 3: Manual smoke (dev server optional)** — if a dev server is available, load `/photoshoot`, compose a prompt, confirm `/photoshoot/new` drafts and prefills; otherwise rely on e2e in Phase 5.
- [ ] **Step 4: Commit**
```bash
git add src/components/photoshoot/PhotoshootWizard.tsx
git commit -m "feat(photoshoot): compose-driven wizard with editable name, prompt, and per-style review"
```

### Task 13: Cook route accepts a free `title` and confirms image delivery

**Files:** Modify `src/app/api/photoshoot/cook/route.ts`

- [ ] **Step 1: Accept `title` in the cook body**

Extend `cookSchema` with an optional title, and use it for the created shoot:
```ts
const cookSchema = photoshootBriefSchema.extend({
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  enhancedPrompts: z.record(z.string(), enhancedPromptSchema).optional(),
  title: z.string().min(1).max(120).optional(),
});
```
Destructure `title` alongside the rest, and change the `createPhotoshoot` call:
```ts
  const { referenceAssetIds, enhancedPrompts: clientEnhanced, title, ...brief } = body;
  // ...
  const shoot = await createPhotoshoot({
    userId: userKey,
    title: title?.trim() || brief.productName,
    // ...unchanged
  });
```

- [ ] **Step 2: Confirm product + reference images reach the orchestrator**

No code change expected — verify by reading: `referenceAssetIds` (which now includes the `product:<id>` from the composer) flows through `getPublicUrls` (line ~63) into `images: refUrls` on the `VitrineImageGenInput` (line ~100). `getPublicUrls` already resolves both `asset:` and `product:` prefixes. If, and only if, the wizard sends the product separately from `referenceAssetIds`, fix the wizard (Task 12) to include the `product:<id>` in `referenceAssetIds`. Add a one-line comment noting product images are delivered as references.

- [ ] **Step 3: Verify + Commit**
```bash
pnpm typecheck
git add src/app/api/photoshoot/cook/route.ts
git commit -m "feat(photoshoot): persist a free-text title and document image delivery"
```

---

## Phase 4 — Details page rebuilt to the campaign row layout

### Task 14: `PhotoshootResultRow` (one style row, horizontal variants, per-variant menu)

**Files:** Create `src/components/photoshoot/PhotoshootResultRow.tsx`

Model this on `src/components/campaigns/CampaignCreativeRow.tsx` (read it — Task already cites its structure). Differences:
- A row represents **one photoshoot tile** (a style): header = the template `label` + "N variants" where N = `tile.quantity`; **no ratio/preset badge**.
- Body = `flex gap-3 overflow-x-auto pb-1`; render `tile.quantity` slots, each an image fed by `useTileWorkflow(tile.workflowId, { status, imageUrls })` (import from `@/components/campaigns/useTileWorkflow`). Slot `i` shows `imageUrls[i]` or a skeleton.
- Each image's overflow `⋮` menu has: **edit** (link to the photoshoot creative editor for that image if the app has one — check how `CreativeCard` builds its edit href for `context="photoshoot"`; if there's no per-image photoshoot editor route, omit edit and keep download/use-as-product/use-in-campaign), **download**, **use as product image** (calls `onUseAsProduct(assetId|url)`), **use in campaign** (calls `onUseInCampaign(assetId|url)`), and **regenerate** (row-level redo → `POST /api/photoshoot/${shootId}/tiles/${tile.id}/regenerate`, then `setWorkflowId(data.workflowId)`).
- Props:
  ```tsx
  type Props = {
    shootId: string;
    tile: PhotoshootTile; // has templateId, workflowId, status, quantity, assetId
    onUseAsProduct: (assetId: string) => void;
    onUseInCampaign: (assetId: string) => void;
  };
  ```
  Resolve the template label via `PHOTOSHOOT_TEMPLATES[tile.templateId].label`. Resolve the aspect ratio for the thumbnail box from `shoot.brief.ratio` (pass ratio in as a prop or derive a width/height). For "use as product / use in campaign" you need an asset id per image; `tile.assetId` is only the first image's asset. For non-first variants that lack a resolved asset id, you may disable those two menu items (only the linked first image is guaranteed to have an asset). Document this limitation in a comment.

Reuse the click-outside/Escape menu pattern from `CampaignCreativeRow`'s `RowImage`. Add `data-testid="pshoot-result-row"` on the section and `data-testid="row-image-menu"` on the menu button (parallel to campaigns) so e2e can target them.

- [ ] **Step 1: Implement the component.**
- [ ] **Step 2: Verify** — `pnpm typecheck` (the component may be unused until Task 15; that's fine — typecheck still validates it).
- [ ] **Step 3: Commit**
```bash
git add src/components/photoshoot/PhotoshootResultRow.tsx
git commit -m "feat(photoshoot): per-style result row with horizontal variants"
```

### Task 15: Rebuild `PhotoshootResults` around rows

**Files:** Modify `src/components/photoshoot/PhotoshootResults.tsx`

- [ ] **Step 1: Replace the flat grid with grouped rows**

Changes:
- Remove `ratioToPresetId` and the `presetId` badge entirely.
- Remove the source-product / "// N templates · shots" block between the breadcrumb and the `<h1>` title (the `data-testid="pshoot-source-product"` div). Keep the breadcrumb, the `BuzzPill` + cooking indicator in the actions row, the inline-editable `<h1>` title, and the status line (which sits below the title — keep it there).
- Remove the select-mode toggle, the `selecting`/`selectedTileIds` state, `computeReadyAssetIds`, and the bottom **bulk action bar**. Per-variant actions now live in each row's menu.
- Keep the `FilterPills` (filter by template group) and the `ProductPickerDialog` wiring.
- Render rows: iterate `shoot.tiles` (each tile = one style) and render `<PhotoshootResultRow shootId={shoot.id} tile={tile} ratio={shoot.brief.ratio} onUseAsProduct={(id) => openProductDialog([id])} onUseInCampaign={(id) => startCampaignWith([id])} />`, each wrapped in a `data-testid={`pshoot-tile-${tile.id}`}` div that stays mounted (`hidden` when filtered out — preserve the "keep mounted for polling" comment). Container: `<div className="mt-6 flex flex-col">`.
- Keep `tileAssetById`, `openProductDialog`, `onDialogSuccess`, `startCampaignWith`, and the dialog at the bottom. `computeReadyAssetIds` and its export can go if nothing else imports it — grep first (`grep -rn computeReadyAssetIds src`).

- [ ] **Step 2: Verify** — `pnpm typecheck`.
- [ ] **Step 3: Commit**
```bash
git add src/components/photoshoot/PhotoshootResults.tsx
git commit -m "feat(photoshoot): campaign-style details layout with per-style rows"
```

---

## Phase 5 — e2e + final verification

### Task 16: Update photoshoot e2e specs and DB seeders

**Files:** `e2e/60-photoshoot.spec.ts`, `e2e/55-photoshoot-cross-flow.spec.ts`, `e2e/61-photoshoot-regenerate.spec.ts`, `e2e/65-photoshoot-subject.spec.ts`, helpers under `e2e/helpers/`.

**Read each spec first.** The flow changed: there's now a compose step (PromptComposer on `/photoshoot`), a draft call, a `configure` step (name + prompt + styles + ratio + estimate), a `review` step (per-style editable cards), then cook; the details page is rows with per-variant menus instead of `CreativeCard` tiles + bulk bar.

- [ ] **Step 1: Update `60-photoshoot.spec.ts`** to drive the new path: from `/photoshoot`, type a prompt into the composer (`getByPlaceholder(/describe the photoshoot/i)`), submit → land on `/photoshoot/new`, wait for the draft to prefill, set a name, ensure ≥1 style selected, pick a ratio (include a `16:9` assertion), advance to review, assert one card per selected style, cook, then assert navigation to `/photoshoot/<id>` and that `pshoot-result-row` elements render. Use the MSW orchestrator mock already in place.

- [ ] **Step 2: Update `65-photoshoot-subject.spec.ts`** — the old `subject-panel` confirmation UI is gone. Either (a) rewrite it to assert the legacy `?subject=asset:<id>` deep-link now pre-selects that asset as a read-only reference on the configure step, or (b) if the cross-flow is better covered by `55`, delete this spec and fold one assertion into `55`. Prefer (a) to keep deep-link coverage. Update the asset-detail link expectation only if you changed that link (you did not).

- [ ] **Step 3: Update `55-photoshoot-cross-flow.spec.ts` and `61-photoshoot-regenerate.spec.ts`** — adjust selectors: details tiles are now `pshoot-result-row` with `row-image-menu` overflow menus; "use as product image" / "use in campaign" / "regenerate" are menu items, not a bulk bar. Regenerate spec: open a row's menu, click regenerate, assert the workflow swaps.

- [ ] **Step 4: Check the grouped seeder** — if a helper seeds photoshoots with one tile per template/multi-image, confirm the new details layout renders it (rows per tile). Adjust the seeder only if a spec needs multiple variant images per tile to exercise the horizontal list.

- [ ] **Step 5: Run the photoshoot specs**

Run: `pnpm test:e2e -- 60-photoshoot 55-photoshoot 61-photoshoot 65-photoshoot` (or the project's documented invocation — check `package.json` `test:e2e` and `README` › End-to-end tests for the exact filter syntax; if filtering isn't supported, run the full `pnpm test:e2e`).
Expected: the photoshoot specs pass. Investigate any failure to root cause (do not skip tests).

- [ ] **Step 6: Commit**
```bash
git add e2e/ src/mocks/handlers.ts
git commit -m "test(photoshoot): cover compose→configure→review flow and row details"
```

### Task 17: Full verification sweep

- [ ] **Step 1: Typecheck** — `pnpm typecheck` → no errors.
- [ ] **Step 2: Lint/format** — `pnpm lint` (fix anything new this branch introduced) and `pnpm format:check` (run `pnpm format` if it flags this branch's files).
- [ ] **Step 3: Unit tests** — `pnpm vitest run src/lib/photoshoots.coverThumbs.test.ts src/lib/photoshootDraft.test.ts` → green. (Note: two component suites are red on `main` and are NOT regressions — confirm they are the same two before/after.)
- [ ] **Step 4: Full e2e** — `pnpm test:e2e` → photoshoot + campaign specs green (campaign specs guard the shared `PromptComposer` change).
- [ ] **Step 5: Final commit (if lint/format touched files)**
```bash
git add -A -- src e2e
git commit -m "chore(photoshoot): lint and format pass"
```

---

## Self-Review (author check, done)

- **Spec coverage** — grid label (T1), ≤4 columns (T2), cover fill (T3), shared composer + product/ref selection + LLM prompt/style improvement (T6–T12), improved style prompts (T4), prefilled read-only product/refs + free name + editable prompt + preselected styles (T12), 16:9 (T4–T5), estimate on configure (T12), inline-editable per-style review one-card-per-style (T12), better style prompts (T4), product+reference images to orchestrator (T13), details campaign-style rows (T14–T15), remove `linkedin · 1:1` badge (T15), relocate use-as-product/use-in-campaign to per-variant menu (T14–T15), remove breadcrumb↔title text (T15). All feedback bullets mapped.
- **Placeholders** — none; code provided for surgical/lib tasks, structural guidance + exact reference files/classes for the large UI rebuilds (which require reading the live file first, called out per task).
- **Type consistency** — `PhotoshootDraft.{title,prompt,templateIds}` used consistently in T6/T7/T12; cook `title` field consistent T12/T13; `pickCoverThumbs` signature consistent T3; `PhotoshootResultRow` props consistent T14/T15.
- **Sequencing risk** — T11+T12 are coupled (wizard prop change); plan calls out combining their commit if typecheck demands. T4 intentionally leaves a transient enum gap closed by T5, flagged in T4 Step 3.
