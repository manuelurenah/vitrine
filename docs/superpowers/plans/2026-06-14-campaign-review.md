# Campaign Review Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight changes from the 2026-06-14 campaign review — row-per-variant detail layout, sticky editor panel, estimated fix-layout cost, palette + logo editing sent to the orchestrator, per-version image display, and an honest canvas.

**Architecture:** Backend/lib changes first (version-image join, a shared regenerate-input builder, logo prompt directive, palette/logo overrides on the regenerate route, a new estimate route). Then the campaign-detail row UI (extracting the existing poll loop into a reusable hook). Then the editor UI (sticky panel, version-driven canvas, palette + logo panels, live estimate). No DB migration: per-version images resolve through the existing `workflowId` shared by `tile_versions` and `assets`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle/Postgres, `@civitai/app-sdk/orchestrator`, Tailwind 3.4, Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-14-campaign-review-design.md`

---

## File Structure

**Create:**
- `src/lib/regenerateInput.ts` — pure builder turning (campaign, tile, brand, refs, options) into a `VitrineImageGenInput` + final prompt. Shared by the regenerate route and the new estimate route so they never drift.
- `src/lib/regenerateInput.test.ts` — unit tests for the builder.
- `src/app/api/campaigns/[id]/tiles/[tileId]/estimate/route.ts` — `POST` returns the fix-layout/regenerate Buzz estimate without spending.
- `src/app/api/campaigns/[id]/tiles/[tileId]/estimate/route.test.ts`
- `src/components/campaigns/useTileWorkflow.ts` — reusable workflow poll hook (extracted from `CreativeCard`).
- `src/components/campaigns/CampaignCreativeRow.tsx` — one row per tile (header + status + horizontal image strip + per-image menu + row download/redo).

**Modify:**
- `src/lib/tileVersionsDiff.ts` — add `assetUrl` to `TileVersionEntry`.
- `src/lib/tileVersions.ts` — `listTileVersions` LEFT JOINs `assets` on `workflowId`; `toTileVersionEntry` carries `assetUrl`.
- `src/lib/promptBuilder.ts` — add optional `logo` flag + `logoLayer()` directive to `buildCampaignPrompt`.
- `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts` — accept `palette` + `logo` overrides; use the shared builder.
- `src/components/campaigns/CreativeCard.tsx` — consume `useTileWorkflow` (no behavior change).
- `src/components/campaigns/CampaignCreativeGrid.tsx` — render `CampaignCreativeRow`s (campaign context) instead of a card grid.
- `src/components/campaigns/CreativeEditor.tsx` — sticky panel; version-driven canvas; remove DOM overlay; palette + logo panels; live estimate; pass overrides to regenerate.
- `src/components/campaigns/VersionHistory.tsx` — show each version's real image.
- `src/app/(app)/campaigns/[id]/c/[creativeId]/page.tsx` + `history/page.tsx` — pass `brandPalette`, `brandLogoUrl`.

---

## Task 1: Per-version image — type + query

**Files:**
- Modify: `src/lib/tileVersionsDiff.ts` (add field to `TileVersionEntry`)
- Modify: `src/lib/tileVersions.ts` (`listTileVersions`, `toTileVersionEntry`)
- Test: `src/lib/tileVersions.test.ts` (create if absent)

- [ ] **Step 1: Add `assetUrl` to the client-safe type**

In `src/lib/tileVersionsDiff.ts`, extend `TileVersionEntry`:

```ts
export type TileVersionEntry = {
  id: string;
  version: number;
  workflowId: string;
  prompt: string;
  adCopy: AdCopy | null;
  assetId: string | null;
  assetUrl: string | null;
  changeNote: string | null;
  createdAt: number;
};
```

- [ ] **Step 2: Carry `assetUrl` through `toTileVersionEntry`**

In `src/lib/tileVersions.ts`, `toTileVersionEntry` currently takes a `TileVersionRow`. Change it to accept the resolved url and set it. Replace the function:

```ts
function toTileVersionEntry(row: TileVersionRow, assetUrl: string | null = null): TileVersionEntry {
  return {
    id: row.id,
    version: row.version,
    workflowId: row.workflowId,
    prompt: row.prompt,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    assetId: row.assetId ?? null,
    assetUrl,
    changeNote: row.changeNote ?? null,
    createdAt: row.createdAt.getTime(),
  };
}
```

Update the two other synthetic `TileVersionEntry` constructions in this file (`restoreTileVersion` return value) to include `assetUrl: null`.

- [ ] **Step 3: Join `assets` by `workflowId` in `listTileVersions`**

Replace the select/join in `listTileVersions` so each version resolves its first image. Assets store `storageKey = ${workflowId}/${i}`; the first image is `${workflowId}/0`. Use a correlated lookup keyed by `workflowId`:

```ts
export async function listTileVersions(
  userId: string,
  campaignId: string,
  tileId: string,
): Promise<TileVersionEntry[]> {
  const rows = await db
    .select({
      id: tileVersionsTable.id,
      version: tileVersionsTable.version,
      workflowId: tileVersionsTable.workflowId,
      prompt: tileVersionsTable.prompt,
      adCopy: tileVersionsTable.adCopy,
      assetId: tileVersionsTable.assetId,
      changeNote: tileVersionsTable.changeNote,
      generationId: tileVersionsTable.generationId,
      createdAt: tileVersionsTable.createdAt,
    })
    .from(tileVersionsTable)
    .innerJoin(campaignTilesTable, eq(campaignTilesTable.id, tileVersionsTable.tileId))
    .innerJoin(campaignsTable, eq(campaignsTable.id, campaignTilesTable.campaignId))
    .where(
      and(
        eq(campaignsTable.userId, userId),
        eq(campaignsTable.id, campaignId),
        eq(tileVersionsTable.tileId, tileId),
      ),
    )
    .orderBy(asc(tileVersionsTable.version));

  // Resolve one public URL per distinct workflowId (the first generated image).
  const workflowIds = [...new Set(rows.map((r) => r.workflowId))];
  const urlByWorkflow = new Map<string, string>();
  if (workflowIds.length > 0) {
    const assetRows = await db
      .select({
        workflowId: assetsTable.workflowId,
        storageKey: assetsTable.storageKey,
        publicUrl: assetsTable.publicUrl,
      })
      .from(assetsTable)
      .where(and(inArray(assetsTable.workflowId, workflowIds), isNull(assetsTable.deletedAt)))
      .orderBy(asc(assetsTable.storageKey));
    for (const a of assetRows) {
      if (a.workflowId && !urlByWorkflow.has(a.workflowId)) {
        urlByWorkflow.set(a.workflowId, a.publicUrl);
      }
    }
  }

  return rows.map((r) =>
    toTileVersionEntry(
      { ...r, tileId, generationId: r.generationId ?? null } as TileVersionRow,
      urlByWorkflow.get(r.workflowId) ?? null,
    ),
  );
}
```

Add the imports at the top of `src/lib/tileVersions.ts` if missing: `inArray`, `isNull` from `drizzle-orm`, and `assets as assetsTable` from `@/lib/db/schema`.

- [ ] **Step 4: Test the join**

Add `src/lib/tileVersions.test.ts`. Mock the db, or follow the existing test style in the repo (check a sibling `*.test.ts` for the mock pattern). The assertion that matters: a version whose `workflowId` has a matching non-deleted asset gets that `publicUrl` as `assetUrl`; a version whose workflow has no asset gets `assetUrl: null`; two versions sharing a `workflowId` both resolve to the same url.

```ts
// Pseudocode of the behavioral assertion (adapt to the repo's db-mock style):
// given assets: [{ workflowId: 'w1', storageKey: 'w1/0', publicUrl: 'https://img/a' }]
// and versions:  [{ version: 1, workflowId: 'w1' }, { version: 2, workflowId: 'w1' }, { version: 3, workflowId: 'w2' }]
// expect entries[0].assetUrl === 'https://img/a'
// expect entries[1].assetUrl === 'https://img/a'
// expect entries[2].assetUrl === null
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: passes.

```bash
git add src/lib/tileVersionsDiff.ts src/lib/tileVersions.ts src/lib/tileVersions.test.ts
git commit -m "feat(versions): resolve per-version image url via workflowId join"
```

---

## Task 2: Logo prompt directive in `promptBuilder`

**Files:**
- Modify: `src/lib/promptBuilder.ts`
- Test: `src/lib/promptBuilder.test.ts` (create if absent, else extend)

- [ ] **Step 1: Add a failing test for the logo directive**

Add to `src/lib/promptBuilder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCampaignPrompt } from './promptBuilder';
import { PRESETS } from './presets';

const brief = { title: 't', description: 'a serum bottle', goal: 'sales', offer: '', prompt: '' } as never;

describe('buildCampaignPrompt logo', () => {
  it('omits the logo directive by default', () => {
    const p = buildCampaignPrompt({ brief, preset: PRESETS['ig-feed'], referenceCount: 1 });
    expect(p.finalPrompt.toLowerCase()).not.toContain('brand logo');
  });
  it('adds the logo directive when logo is true', () => {
    const p = buildCampaignPrompt({ brief, preset: PRESETS['ig-feed'], referenceCount: 1, logo: true });
    expect(p.finalPrompt.toLowerCase()).toContain('brand logo');
  });
});
```

- [ ] **Step 2: Run it, watch the second case fail**

Run: `pnpm vitest run src/lib/promptBuilder.test.ts`
Expected: the "adds the logo directive" case FAILS (no logo handling yet).

- [ ] **Step 3: Implement the directive**

In `src/lib/promptBuilder.ts`, add to `BuildCampaignPromptInput`:

```ts
export type BuildCampaignPromptInput = {
  brief: BriefForPresets;
  brand?: BrandProfile | null;
  preset: PresetDef;
  referenceCount?: number;
  userOverride?: string;
  adCopy?: AdCopy | null;
  /** When true, instruct the model to incorporate the supplied brand logo. */
  logo?: boolean;
};
```

Add a helper near `copyLayer`:

```ts
function logoLayer(): string {
  return 'incorporate the supplied brand logo as a small mark in a corner, preserving its exact shape, proportions, and colors; do not distort or restyle it';
}
```

In `buildCampaignPrompt`, destructure `logo` and append the layer to the assembled prompt:

```ts
export function buildCampaignPrompt(input: BuildCampaignPromptInput): EnhancedPrompt {
  const { brief, brand, preset, referenceCount = 0, userOverride, adCopy, logo } = input;
  // ... existing base / brandStr / refStr / intentStr / styleStr / copyStr ...
  const logoStr = logo ? logoLayer() : '';
  const finalPrompt = assemble([intentStr, base, brandStr, refStr, styleStr, copyStr, logoStr]);
  // ... unchanged return ...
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm vitest run src/lib/promptBuilder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptBuilder.ts src/lib/promptBuilder.test.ts
git commit -m "feat(prompt): optional brand-logo directive in campaign prompt"
```

---

## Task 3: Shared regenerate-input builder

**Files:**
- Create: `src/lib/regenerateInput.ts`
- Create: `src/lib/regenerateInput.test.ts`

This centralizes the exact input the orchestrator receives so the estimate route and the regenerate route are guaranteed identical (minus the variation suffix, which doesn't affect cost). It is pure (no db, no session) — callers resolve `refUrls`/`brand` and pass them in.

- [ ] **Step 1: Write the builder**

```ts
import type { BrandProfile } from './brand';
import type { Campaign, CampaignTile } from './campaigns';
import type { VitrineImageGenInput } from './imageGenBody';
import {
  buildCampaignPrompt,
  type EnhancedPrompt,
  resolveFinalPrompt,
} from './promptBuilder';
import { PRESETS } from './presets';

export type RegenOptions = {
  /** Fix-layout: re-edit the tile's current image instead of the product refs. */
  relayout?: boolean;
  promptHint?: string;
  /** Override the brand palette for this generation only. */
  paletteOverride?: string[];
  /** Brand logo url; included in images[] + prompt when includeLogo is true. */
  logoUrl?: string | null;
  includeLogo?: boolean;
  /** Variation seed appended to the prompt. Omit for estimates (cost is identical). */
  variation?: number | null;
};

function isEnhancedPrompt(value: unknown): value is EnhancedPrompt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.finalPrompt === 'string' && typeof v.aspectRatio === 'string';
}

export function buildTileRegenInput(args: {
  campaign: Pick<Campaign, 'brief' | 'enhancedPrompts'>;
  tile: Pick<CampaignTile, 'presetId' | 'adCopy' | 'quantity' | 'assetUrl'>;
  brand: BrandProfile | null;
  refUrls: string[];
  variantsPerPreset: number;
  options: RegenOptions;
}): { input: VitrineImageGenInput; prompt: string } {
  const { campaign, tile, brand, refUrls, variantsPerPreset, options } = args;
  const preset = PRESETS[tile.presetId];

  // Apply palette override without mutating the source brand.
  const effectiveBrand: BrandProfile | null =
    brand && options.paletteOverride
      ? { ...brand, palette: options.paletteOverride }
      : brand;

  // Fix-layout edits the existing creative; plain regen uses the product refs.
  const baseEditImages = options.relayout && tile.assetUrl ? [tile.assetUrl] : refUrls;
  const editImages =
    options.includeLogo && options.logoUrl
      ? [...baseEditImages, options.logoUrl]
      : baseEditImages;

  // Rebuild the prompt whenever copy / palette / logo can influence it; only fall
  // back to the persisted enhanced prompt for a plain, override-free variation.
  const mustRebuild =
    !!tile.adCopy || !!options.paletteOverride || !!options.includeLogo;
  const persisted = campaign.enhancedPrompts?.[tile.presetId];
  const enhanced: EnhancedPrompt = mustRebuild
    ? buildCampaignPrompt({
        brief: campaign.brief,
        brand: effectiveBrand,
        preset,
        referenceCount: editImages.length,
        ...(tile.adCopy ? { adCopy: tile.adCopy } : {}),
        ...(options.includeLogo ? { logo: true } : {}),
      })
    : isEnhancedPrompt(persisted)
      ? persisted
      : buildCampaignPrompt({
          brief: campaign.brief,
          brand: effectiveBrand,
          preset,
          referenceCount: editImages.length,
        });

  const basePrompt = resolveFinalPrompt(enhanced);
  const withHint = options.promptHint ? `${basePrompt}\n\n${options.promptHint}` : basePrompt;
  const prompt =
    options.variation === null || options.variation === undefined
      ? withHint
      : `${withHint} · variation ${options.variation}`;

  const quantity = tile.quantity ?? variantsPerPreset ?? 1;

  const input: VitrineImageGenInput = {
    prompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: quantity,
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(editImages.length > 0 ? { images: editImages } : {}),
  };

  return { input, prompt };
}
```

- [ ] **Step 2: Write tests**

`src/lib/regenerateInput.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTileRegenInput } from './regenerateInput';

const campaign = {
  brief: { title: 't', description: 'serum', goal: 'sales', offer: '', prompt: '' },
  enhancedPrompts: null,
} as never;
const tile = { presetId: 'ig-feed', adCopy: null, quantity: 3, assetUrl: 'https://img/live' } as never;
const brand = { name: 'Acme', palette: ['#111111'], logoUrl: 'https://img/logo' } as never;

describe('buildTileRegenInput', () => {
  it('uses the live image for relayout, product refs otherwise', () => {
    const relayout = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: { relayout: true } });
    expect(relayout.input.images).toEqual(['https://img/live']);
    const plain = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: {} });
    expect(plain.input.images).toEqual(['https://img/ref']);
  });
  it('appends the logo to images and the directive to the prompt when included', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: ['https://img/ref'], variantsPerPreset: 3, options: { includeLogo: true, logoUrl: 'https://img/logo' } });
    expect(r.input.images).toContain('https://img/logo');
    expect(r.prompt.toLowerCase()).toContain('brand logo');
  });
  it('injects the palette override into the prompt', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { paletteOverride: ['#ABCDEF'] } });
    expect(r.prompt).toContain('#ABCDEF');
  });
  it('omits the variation suffix when variation is null (estimate parity)', () => {
    const est = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { variation: null } });
    expect(est.prompt).not.toContain('variation');
    const sub = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: { variation: 42 } });
    expect(sub.prompt).toContain('variation 42');
  });
  it('respects tile.quantity for numImages', () => {
    const r = buildTileRegenInput({ campaign, tile, brand, refUrls: [], variantsPerPreset: 3, options: {} });
    expect(r.input.numImages).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/lib/regenerateInput.test.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/regenerateInput.ts src/lib/regenerateInput.test.ts
git commit -m "feat(campaigns): shared tile regenerate-input builder"
```

---

## Task 4: Regenerate route uses the builder + accepts overrides

**Files:**
- Modify: `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts`
- Test: `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.test.ts` (extend)

- [ ] **Step 1: Widen the body schema**

Replace `bodySchema`:

```ts
const bodySchema = z
  .object({
    promptHint: z.string().max(400).optional(),
    relayout: z.boolean().optional(),
    /** Palette override (hex strings) applied to this generation only. */
    palette: z.array(z.string().max(9)).max(8).optional(),
    /** Include the brand logo in the generation. */
    includeLogo: z.boolean().optional(),
  })
  .optional();
```

- [ ] **Step 2: Replace the inline input-building with the shared builder**

Keep the session/ownership/refUrls resolution as-is. Then replace the block that builds `enhanced` / `promptWithVariation` / `input` (current lines ~71-105) with:

```ts
const palette = parsedBody.success ? parsedBody.data?.palette : undefined;
const includeLogo = parsedBody.success ? (parsedBody.data?.includeLogo ?? false) : false;
const variation = Math.floor(Math.random() * 1000);

const { input, prompt: promptWithVariation } = buildTileRegenInput({
  campaign,
  tile,
  brand,
  refUrls,
  variantsPerPreset: campaign.variantsPerPreset,
  options: {
    relayout,
    ...(promptHint ? { promptHint } : {}),
    ...(palette && palette.length > 0 ? { paletteOverride: palette } : {}),
    includeLogo,
    ...(includeLogo ? { logoUrl: brand?.logoUrl ?? null } : {}),
    variation,
  },
});
```

Add the import: `import { buildTileRegenInput } from '@/lib/regenerateInput';` and drop now-unused imports (`buildCampaignPrompt`, `resolveFinalPrompt`, `PRESETS`, `EnhancedPrompt`, the local `isEnhancedPrompt`) if the typechecker flags them. The `submitImageGen` / `swapTileWorkflow` / `recordGeneration` / `recordBuzzEvent` block below is unchanged.

- [ ] **Step 3: Extend the route test**

Add a case asserting that posting `{ includeLogo: true }` results in `submitImageGen` being called with `images` that includes the brand `logoUrl`, and `{ palette: ['#ABCDEF'] }` puts `#ABCDEF` in the submitted prompt. Follow the existing mock setup in the file (it already mocks `submitImageGen`).

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run src/app/api/campaigns/'[id]'/tiles/'[tileId]'/regenerate/route.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/campaigns/\[id\]/tiles/\[tileId\]/regenerate/route.ts src/app/api/campaigns/\[id\]/tiles/\[tileId\]/regenerate/route.test.ts
git commit -m "feat(regenerate): palette + logo overrides via shared builder"
```

---

## Task 5: Estimate route

**Files:**
- Create: `src/app/api/campaigns/[id]/tiles/[tileId]/estimate/route.ts`
- Create: `src/app/api/campaigns/[id]/tiles/[tileId]/estimate/route.test.ts`

- [ ] **Step 1: Implement the route**

Mirror the regenerate route's resolution, but call `estimateImageGen` (no spend) and return only the cost. Use `variation: null` so the estimate matches the eventual submit.

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { getCampaign } from '@/lib/campaigns';
import { estimateImageGen, OrchestratorError } from '@/lib/civitai';
import { buildTileRegenInput } from '@/lib/regenerateInput';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z
  .object({
    relayout: z.boolean().optional(),
    promptHint: z.string().max(400).optional(),
    palette: z.array(z.string().max(9)).max(8).optional(),
    includeLogo: z.boolean().optional(),
  })
  .optional();

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const opts = parsed.success ? (parsed.data ?? {}) : {};

  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;
  const campaign = await getCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const brand = await getDefaultBrand(userKey);

  let refUrls: string[];
  try {
    refUrls =
      campaign.referenceAssetIds.length > 0
        ? await getPublicUrls(userKey, campaign.referenceAssetIds)
        : [];
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json({ error: 'invalid_reference_assets' }, { status: 400 });
    }
    throw err;
  }

  const includeLogo = opts.includeLogo ?? false;
  const { input } = buildTileRegenInput({
    campaign,
    tile,
    brand,
    refUrls,
    variantsPerPreset: campaign.variantsPerPreset,
    options: {
      relayout: opts.relayout ?? false,
      ...(opts.promptHint ? { promptHint: opts.promptHint } : {}),
      ...(opts.palette && opts.palette.length > 0 ? { paletteOverride: opts.palette } : {}),
      includeLogo,
      ...(includeLogo ? { logoUrl: brand?.logoUrl ?? null } : {}),
      variation: null,
    },
  });

  try {
    const snap = await estimateImageGen(session, input);
    return NextResponse.json({ cost: snap.cost?.total ?? 0 });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    return NextResponse.json({ error: 'estimate_failed' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Test the route**

`estimate/route.test.ts`: mock `getCampaign`, `getDefaultBrand`, `getSession`, `getUserKey`, `estimateImageGen` (resolve `{ cost: { total: 7 } }`). Assert a `200` with `{ cost: 7 }`, and `404` when the tile is missing. Mirror the mock structure of the sibling `regenerate/route.test.ts`.

- [ ] **Step 3: Run + typecheck + commit**

Run: `pnpm vitest run src/app/api/campaigns/'[id]'/tiles/'[tileId]'/estimate/route.test.ts && pnpm typecheck`
Expected: PASS.

```bash
git add src/app/api/campaigns/\[id\]/tiles/\[tileId\]/estimate
git commit -m "feat(api): tile fix-layout buzz estimate route"
```

---

## Task 6: Extract `useTileWorkflow` hook

**Files:**
- Create: `src/components/campaigns/useTileWorkflow.ts`
- Modify: `src/components/campaigns/CreativeCard.tsx` (consume the hook; no behavior change)

The poll loop is duplicated between `CreativeCard` and `CreativeEditor`. Extract `CreativeCard`'s version into a hook so `CampaignCreativeRow` reuses it. (Leave `CreativeEditor`'s copy alone in this task — it is touched in Task 9.)

- [ ] **Step 1: Write the hook**

```ts
'use client';

import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { useEffect, useState } from 'react';

export type TileWorkflowStatus = 'queued' | 'cooking' | 'done' | 'failed';

export function statusFromSnap(snap: WorkflowSnapshot | null): TileWorkflowStatus {
  const s = (snap?.status ?? '').toLowerCase();
  if (s === 'succeeded') return 'done';
  if (s === 'failed' || s === 'canceled' || s === 'expired') return 'failed';
  if (s === 'unassigned' || s === 'pending') return 'queued';
  return 'cooking';
}

export type UseTileWorkflow = {
  status: TileWorkflowStatus;
  imageUrls: string[];
  /** Point the hook at a new workflow id (e.g. after regenerate). */
  setWorkflowId: (id: string) => void;
};

export function useTileWorkflow(
  initialWorkflowId: string,
  initial: { status: TileWorkflowStatus; imageUrls: string[] },
): UseTileWorkflow {
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [status, setStatus] = useState<TileWorkflowStatus>(initial.status);
  const [imageUrls, setImageUrls] = useState<string[]>(initial.imageUrls);

  useEffect(() => {
    let cancelled = false;
    async function loop() {
      // Don't poll a workflow that's already terminal on mount.
      if (initial.status === 'done' || initial.status === 'failed') {
        // still poll if we have no images yet (asset may have synced late)
        if (initial.imageUrls.length > 0) return;
      }
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          setStatus(statusFromSnap(data.snapshot));
          const urls = extractImageUrls(data.snapshot);
          if (urls.length > 0) setImageUrls(urls);
          if (data.done) return;
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  return { status, imageUrls, setWorkflowId };
}
```

> Note: keep the existing `CreativeCard` polling semantics — if `CreativeCard` polls unconditionally on mount, drop the early-return guard above to match its current behavior exactly. The goal of this task is zero behavior change.

- [ ] **Step 2: Consume it in `CreativeCard`**

Replace `CreativeCard`'s inline `useEffect` poll loop + its `status`/`imgUrls`/`workflowId` state with `useTileWorkflow(workflowId, { status: initialStatus, imageUrls: ... })`. Keep every existing `data-testid` and the rendered output identical. Re-export or re-derive `statusFromSnap` from the hook module to avoid a duplicate.

- [ ] **Step 3: Typecheck + e2e smoke**

Run: `pnpm typecheck`
Expected: passes.
Run: `pnpm test:e2e --grep "50-campaigns"` (or the campaigns spec) to confirm the card still cooks/polls.
Expected: passes (or matches the pre-change baseline).

- [ ] **Step 4: Commit**

```bash
git add src/components/campaigns/useTileWorkflow.ts src/components/campaigns/CreativeCard.tsx
git commit -m "refactor(campaigns): extract useTileWorkflow poll hook"
```

---

## Task 7: `CampaignCreativeRow` component

**Files:**
- Create: `src/components/campaigns/CampaignCreativeRow.tsx`

One row per tile: header (`preset.label` + status badge), then a horizontal image strip. Each image: click → editor; three-dots menu (edit / download this / regenerate). Row actions: download-all + redo. No headline/subhead/CTA text.

- [ ] **Step 1: Build the component**

```tsx
'use client';

import { Download, MoreVertical, Pencil, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui';
import type { CampaignTile } from '@/lib/campaigns';
import { downloadImagesAsZip } from '@/lib/downloadZip';
import { PRESETS } from '@/lib/presets';
import { useTileWorkflow } from './useTileWorkflow';

type Props = {
  campaignId: string;
  tile: CampaignTile;
};

export function CampaignCreativeRow({ campaignId, tile }: Props) {
  const preset = PRESETS[tile.presetId];
  const { status, imageUrls, setWorkflowId } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
  });
  const [regenerating, setRegenerating] = useState(false);
  const editHref = `/campaigns/${campaignId}/c/${tile.id}`;
  const slots = Math.max(tile.quantity ?? 1, imageUrls.length || 1);

  async function redo() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.workflowId) setWorkflowId(data.workflowId);
    } finally {
      setRegenerating(false);
    }
  }

  async function downloadAll() {
    if (imageUrls.length === 0) return;
    await downloadImagesAsZip(imageUrls, `${preset.id}-variants`);
  }

  const badgeKind = status === 'done' ? 'live' : status === 'failed' ? 'archived' : 'cooking';
  const badgeText = status === 'done' ? 'ready' : status === 'failed' ? 'failed' : status;

  return (
    <section data-testid="campaign-creative-row" className="border-b border-line-subtle py-5">
      {/* header */}
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[15px] font-semibold text-fg-0">{preset.label}</span>
        <Badge kind={badgeKind} data-testid="row-status-badge">{badgeText}</Badge>
        <span className="font-mono text-[11px] text-fg-3">{preset.ratio}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="row-download"
            aria-label="download all"
            disabled={imageUrls.length === 0}
            onClick={downloadAll}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <Download size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="row-redo"
            aria-label="redo"
            disabled={regenerating || status === 'cooking' || status === 'queued'}
            onClick={redo}
            className="grid size-8 place-items-center rounded-[8px] border border-line-subtle bg-bg-2 text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* horizontal image strip */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: slots }).map((_, i) => {
          const url = imageUrls[i] ?? null;
          return (
            <RowImage
              key={i}
              url={url}
              editHref={editHref}
              ratio={preset.width / preset.height}
              filename={`${preset.id}-${tile.id}-${i}`}
              onRegenerate={redo}
            />
          );
        })}
      </div>
    </section>
  );
}

function RowImage({
  url,
  editHref,
  ratio,
  filename,
  onRegenerate,
}: {
  url: string | null;
  editHref: string;
  ratio: number;
  filename: string;
  onRegenerate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const width = 150;

  function downloadOne() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    a.click();
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-line bg-bg-3"
      style={{ width, aspectRatio: ratio }}
    >
      {url ? (
        <Link href={editHref} aria-label="edit creative">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </Link>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-bg-3" data-testid="row-image-skeleton" />
      )}

      {url && (
        <div className="absolute right-1.5 top-1.5">
          <button
            type="button"
            data-testid="row-image-menu"
            aria-label="image options"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-6 place-items-center rounded-[6px] bg-black/55 text-white backdrop-blur-md"
          >
            <MoreVertical size={13} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-[8px] border border-line-subtle bg-bg-1 py-1 shadow-lg">
              <Link
                href={editHref}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <Pencil size={12} strokeWidth={1.75} /> edit
              </Link>
              <button
                type="button"
                onClick={() => { downloadOne(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <Download size={12} strokeWidth={1.75} /> download
              </button>
              <button
                type="button"
                onClick={() => { onRegenerate(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <RefreshCw size={12} strokeWidth={1.75} /> regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

> Verify `Badge` accepts a `data-testid` passthrough; if not, wrap it or drop the attribute. Confirm `Badge` is exported from `@/components/ui` (it is used in `CreativeCard`). Match the codebase's class tokens (`bg-bg-2`, `border-line-subtle`, etc.) — copy any that differ from `CreativeCard`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/campaigns/CampaignCreativeRow.tsx
git commit -m "feat(campaigns): per-variant creative row component"
```

---

## Task 8: Render rows on the campaign detail page

**Files:**
- Modify: `src/components/campaigns/CampaignCreativeGrid.tsx`

Keep the filter pills; swap the grid of `CreativeCard`s for a stack of `CampaignCreativeRow`s.

- [ ] **Step 1: Replace the grid body**

In `CampaignCreativeGrid.tsx`, keep the `activeFilter` logic and `<FilterPills>`. Replace the grid container + `tiles.map(CreativeCard)` with:

```tsx
<div className="flex flex-col">
  {tiles.map((tile) => {
    const visible = activeFilter === 'all' || tile.presetId === activeFilter;
    return (
      <div key={tile.id} className={visible ? '' : 'hidden'}>
        <CampaignCreativeRow campaignId={campaignId} tile={tile} />
      </div>
    );
  })}
</div>
```

Keep the "hidden but mounted" pattern (so polling continues) — that's why each row stays mounted under a `hidden` wrapper rather than being filtered out of the array. Update imports: remove `CreativeCard`, add `CampaignCreativeRow`. Leave `CreativeCard` in the repo (photoshoots use it).

- [ ] **Step 2: Typecheck + e2e**

Run: `pnpm typecheck`
Expected: passes.
Run the campaigns e2e spec. If it asserts on the old card testids for the detail page, update those assertions to the new row testids (`campaign-creative-row`, `row-status-badge`, `row-download`, `row-redo`). Cooking/polling behavior must still resolve.

- [ ] **Step 3: Commit**

```bash
git add src/components/campaigns/CampaignCreativeGrid.tsx
git commit -m "feat(campaigns): row-per-variant detail layout"
```

---

## Task 9: Editor — version-driven canvas + honest copy

**Files:**
- Modify: `src/components/campaigns/CreativeEditor.tsx`

Implements FB-7 (canvas shows the viewed version's real image) and FB-8 (remove the duplicated DOM text overlay + the false "inspect" line). Also switch the editor's own poll loop to `useTileWorkflow` for consistency.

- [ ] **Step 1: Use the shared hook + derive the canvas image from the version**

Replace the editor's inline poll loop (`CreativeEditor.tsx:68-101`) with the hook, and compute the canvas image from the selected version's `assetUrl`, falling back to live polled urls for the latest version:

```tsx
const { status: pollStatus, imageUrls: liveUrls, setWorkflowId } = useTileWorkflow(tile.workflowId, {
  status: tile.status,
  imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
});

const isLatestVersion = versionIdx >= versions.length - 1;
// Latest version reflects live generation; older versions show their stored image.
const canvasImageUrl = isLatestVersion
  ? (liveUrls[0] ?? currentVersion?.assetUrl ?? null)
  : (currentVersion?.assetUrl ?? null);
```

Update `handleRegenerate` to call `setWorkflowId(data.workflowId)` instead of the old `setWorkflowId` state setter (same name; now from the hook). Remove the now-dead `statusFromSnap`/`imageUrlsFromSnap` local helpers and `imgUrls`/`workflowId`/`pollStatus` `useState`s. Anywhere the old code used `firstImageUrl`, use `canvasImageUrl`. The right-panel "image preview" (`:399`) should also use `canvasImageUrl`.

- [ ] **Step 2: Point the canvas `<img>` at `canvasImageUrl` and remove the DOM text overlay**

In the canvas block (`:251-327`): keep the background `<img>` (now `src={canvasImageUrl}`) and the cooking overlay, but **delete the entire `{canvasAdCopy && (…)}` overlay** (`:267-306`). Remove the now-unused `canvasAdCopy` computation. The baked image already contains the text.

- [ ] **Step 3: Replace the misleading helper line**

Replace `CreativeEditor.tsx:389`:

```tsx
<p className="text-[12px] text-fg-3">edit fields on the right · changes apply when you regenerate.</p>
```

- [ ] **Step 4: Typecheck + e2e**

Run: `pnpm typecheck`
Expected: passes. Update any e2e assertion that depended on the canvas overlay text (the headline is no longer a DOM node on the canvas; it now lives in the right-panel input `editor-field-header`). Keep `data-testid="creative-editor"` and all `editor-*` testids.

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/CreativeEditor.tsx
git commit -m "feat(editor): per-version canvas image; drop duplicated text overlay"
```

---

## Task 10: Editor — sticky right panel (FB-3)

**Files:**
- Modify: `src/components/campaigns/CreativeEditor.tsx`

- [ ] **Step 1: Make the right column sticky**

Change the right-panel container (`CreativeEditor.tsx:395`) from `className="flex flex-col gap-2.5"` to:

```tsx
<div className="flex flex-col gap-2.5 md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto">
```

The grid already has `items-start`, which is required for `sticky` to work inside a grid track.

- [ ] **Step 2: Verify in the running app**

Run the app (`pnpm dev`) or the e2e harness and confirm the right panel follows scroll on a tall page without clipping the save button. Adjust `top`/`max-h` if the app shell has a fixed header offset (check the `(app)` layout's top padding).

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`

```bash
git add src/components/campaigns/CreativeEditor.tsx
git commit -m "feat(editor): sticky right panel"
```

---

## Task 11: Editor — palette + logo panels and brand props (FB-5, FB-6)

**Files:**
- Modify: `src/app/(app)/campaigns/[id]/c/[creativeId]/page.tsx`
- Modify: `src/components/campaigns/CreativeEditor.tsx`

- [ ] **Step 1: Pass brand palette + logo into the editor**

In `page.tsx`, the `brand` is already loaded. Pass two more props:

```tsx
<CreativeEditor
  campaignId={id}
  campaignTitle={campaign.title}
  brandName={brand?.name ?? null}
  brandPalette={brand?.palette ?? []}
  brandLogoUrl={brand?.logoUrl ?? null}
  tile={tile}
  versions={versions}
/>
```

Extend `Props` in `CreativeEditor.tsx`:

```tsx
type Props = {
  campaignId: string;
  campaignTitle: string;
  brandName: string | null;
  brandPalette: string[];
  brandLogoUrl: string | null;
  tile: CampaignTile;
  versions: TileVersionEntry[];
};
```

- [ ] **Step 2: Add palette + logo editing state**

Near the other editor state:

```tsx
const [palette, setPalette] = useState<string[]>(brandPalette.slice(0, 6));
const [includeLogo, setIncludeLogo] = useState(false);
```

- [ ] **Step 3: Replace the read-only logo panel + add a palette panel**

Replace the logo `PanelRow` (`:459-463`) with an editable one, and add a palette `PanelRow` (place it before `background`):

```tsx
{/* palette — editable */}
<PanelRow label="palette">
  <div className="mt-1 flex flex-wrap gap-2">
    {palette.map((c, i) => (
      <label key={i} className="relative size-7 cursor-pointer overflow-hidden rounded-[6px] border border-line-subtle">
        <span className="absolute inset-0" style={{ backgroundColor: c }} />
        <input
          type="color"
          aria-label={`palette color ${i + 1}`}
          value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000'}
          onChange={(e) => setPalette((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    ))}
    {palette.length < 6 && (
      <button
        type="button"
        data-testid="editor-palette-add"
        aria-label="add color"
        onClick={() => setPalette((p) => [...p, '#888888'])}
        className="grid size-7 place-items-center rounded-[6px] border border-dashed border-line-subtle text-fg-3 hover:text-fg-1"
      >
        +
      </button>
    )}
  </div>
  <p className="mt-2 text-[11px] text-fg-3">applied when you regenerate.</p>
</PanelRow>

{/* logo — toggle + preview */}
<PanelRow label="logo">
  <div className="mt-1 flex items-center gap-3">
    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-[8px] border border-line-subtle bg-bg-3">
      {brandLogoUrl ? (
        <img src={brandLogoUrl} alt="brand logo" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[9px] text-fg-3">no logo</span>
      )}
    </div>
    <label className="flex items-center gap-2 text-[12px] text-fg-1">
      <input
        type="checkbox"
        data-testid="editor-logo-toggle"
        checked={includeLogo}
        disabled={!brandLogoUrl}
        onChange={(e) => setIncludeLogo(e.target.checked)}
      />
      include logo on regenerate
    </label>
  </div>
</PanelRow>
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
Expected: passes (palette/logo not yet wired into the request — that's Task 12; unused-var warnings are acceptable mid-stack but prefer wiring in 12 immediately after).

```bash
git add "src/app/(app)/campaigns/[id]/c/[creativeId]/page.tsx" src/components/campaigns/CreativeEditor.tsx
git commit -m "feat(editor): palette + logo editing panels"
```

---

## Task 12: Editor — live estimate + send overrides on regenerate (FB-4)

**Files:**
- Modify: `src/components/campaigns/CreativeEditor.tsx`

- [ ] **Step 1: Fetch the estimate**

Add state + an effect that fetches the fix-layout estimate, re-running when palette/logo change (debounced):

```tsx
const [fixCost, setFixCost] = useState<number | null>(null);

useEffect(() => {
  let cancelled = false;
  const t = setTimeout(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/estimate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          relayout: true,
          ...(palette.length > 0 ? { palette } : {}),
          includeLogo,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { cost: number };
      if (!cancelled) setFixCost(data.cost);
    } catch {
      /* leave previous estimate */
    }
  }, 400);
  return () => {
    cancelled = true;
    clearTimeout(t);
  };
}, [campaignId, tile.id, palette, includeLogo]);

const fixCostLabel = fixCost === null ? '…' : String(fixCost);
```

- [ ] **Step 2: Replace both hardcoded "3 buzz" strings**

`CreativeEditor.tsx:341`:

```tsx
<span className="ml-1 font-mono text-[11px] opacity-70">· {fixCostLabel} buzz</span>
```

`CreativeEditor.tsx:502`:

```tsx
<span className="ml-auto font-mono text-[10px] text-volt">{fixCostLabel} buzz</span>
```

- [ ] **Step 3: Send palette + logo on regenerate / fix-layout**

In `handleRegenerate`, include the overrides in the POST body:

```tsx
async function handleRegenerate(fixLayout?: boolean) {
  setRegenerating(true);
  setPollStatusToCooking(); // or rely on the hook; remove if not applicable
  try {
    const body: Record<string, unknown> = {};
    if (fixLayout) {
      body.promptHint = '[fix layout: improve composition, balance, legibility]';
      body.relayout = true;
    }
    if (palette.length > 0) body.palette = palette;
    if (includeLogo) body.includeLogo = true;
    const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    if (data.workflowId) setWorkflowId(data.workflowId);
    router.refresh();
  } finally {
    setRegenerating(false);
  }
}
```

> Adjust to the hook from Task 9: the hook owns status; setting cooking on submit is optional (the poll will report it). Remove the placeholder `setPollStatusToCooking()` if the hook doesn't expose it — just rely on `setWorkflowId`.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
Expected: passes (no unused `palette`/`includeLogo` now).

```bash
git add src/components/campaigns/CreativeEditor.tsx
git commit -m "feat(editor): live fix-layout estimate; send palette + logo overrides"
```

---

## Task 13: Version history shows version images (FB-7)

**Files:**
- Modify: `src/components/campaigns/VersionHistory.tsx`
- Modify: `src/app/(app)/campaigns/[id]/c/[creativeId]/history/page.tsx` (no change needed if it already passes `versions` from `listTileVersions`)

- [ ] **Step 1: Render the selected version's image**

In `VersionHistory.tsx`, replace the placeholder `<CanvasField />` (around `:220`) with the selected version's real image, and remove the duplicated ad-copy overlay below it (baked into the image):

```tsx
{/* canvas */}
<div
  className="relative w-full max-w-[480px] overflow-hidden rounded-[14px] border border-line bg-bg-3"
  style={{ aspectRatio: aspect }}
>
  {selected?.assetUrl ? (
    <img src={selected.assetUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <CanvasField />
  )}

  {/* version badge — unchanged */}
  {/* …keep the existing version badge block… */}
</div>
```

Delete the `{canvasAdCopy && (…)}` overlay block that follows the badge (text is baked into `assetUrl`). Remove the now-unused `canvasAdCopy` local if nothing else uses it. Keep `CanvasField` as the fallback for versions whose image hasn't synced.

- [ ] **Step 2: Confirm the history page passes assetUrl**

`history/page.tsx` already calls `listTileVersions` (now returning `assetUrl`) and passes `versions` to `VersionHistory`. No change needed beyond confirming the prop type flows. If `VersionHistory`'s `Props.versions` is typed via `TileVersionEntry`, `assetUrl` is already present.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: passes.

```bash
git add src/components/campaigns/VersionHistory.tsx
git commit -m "feat(history): show each version's generated image"
```

---

## Task 14: Full verification

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Unit tests**

Run: `pnpm vitest run`
Expected: green (note any pre-existing failures from the memory note — 2 component suites were already red on main; confirm no *new* failures).

- [ ] **Step 3: Lint / build as applicable**

Run: `pnpm lint` (if present) and `pnpm build` if security headers / config were touched (they weren't, so build is optional).

- [ ] **Step 4: E2E**

Run: `pnpm test:e2e` (campaigns specs at minimum). Fix any selector drift introduced by the row redesign + editor canvas changes.

- [ ] **Step 5: Final commit if any fixups**

```bash
git add -A && git commit -m "test: fixups for campaign review changes"
```

---

## Self-Review (author check)

- **FB-1 row layout** → Tasks 7, 8. ✓
- **FB-2 row download + redo** → Task 7 (`row-download`, `row-redo`, per-image menu). ✓
- **FB-3 sticky panel** → Task 10. ✓
- **FB-4 estimated buzz** → Tasks 3, 5, 12 (builder → estimate route → editor display). ✓
- **FB-5 palette editing → orchestrator** → Tasks 3, 4, 11, 12. ✓
- **FB-6 logo editing → orchestrator** → Tasks 2, 3, 4, 11, 12. ✓
- **FB-7 version image** → Tasks 1, 9, 13. ✓
- **FB-8 honest canvas** → Task 9 (remove overlay + fix copy). ✓
- **Type consistency:** `TileVersionEntry.assetUrl`, `useTileWorkflow`/`statusFromSnap`, `buildTileRegenInput`/`RegenOptions`, `estimate` body shape — names are stable across Tasks 1, 3, 4, 5, 6, 9, 11, 12. ✓
- **No placeholders:** every code step has concrete code; UI tasks reference exact files/lines and the surrounding real code. Subagents read the live files before editing. ✓
