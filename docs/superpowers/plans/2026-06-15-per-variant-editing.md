# Per-variant Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every variant of a campaign creative independently editable, with its own version history and its own regenerate, by modelling each variant as its own `campaign_tiles` row grouped by a shared `variant_group_id`.

**Architecture:** Approach A — "variant *is* a tile, grouped." Cook submits N single-image workflows per preset instead of one N-image workflow, producing N sibling tiles (`quantity=1`) that share a `variant_group_id`. The grid groups tiles back into one row per creative. Per-tile machinery (`tile_versions`, regenerate, estimate, `CreativeEditor`, `PATCH /tiles/[tileId]`) is reused unchanged. Legacy campaigns (NULL `variant_group_id`) keep rendering as a single multi-image tile via the existing `?v=` editor path. No data migration.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19, Drizzle ORM + Postgres, Vitest (unit), Playwright + MSW (e2e). Mirrors the existing `photoshoot_tiles.variant_index` per-variant pattern.

**Reference spec:** `docs/superpowers/specs/2026-06-15-per-variant-editing-design.md`

**Branch:** `fix/creative-editor-variant-selection` (already checked out).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/db/schema.ts` | `campaign_tiles` table def | Add `variantGroupId`, `variantIndex` cols + index |
| `drizzle/NNNN_*.sql` | migration | Generated |
| `src/lib/campaigns.ts` | campaign/tile domain types + persistence | `CampaignTile` + `toTile` + `CreateCampaignInput` + `createCampaign` carry/insert the two fields |
| `src/app/api/campaigns/cook/route.ts` | cook orchestration | P×N submit fan-out, one `variant_group_id` per preset, `quantity=1` |
| `src/app/api/campaigns/cook/route.test.ts` | cook unit tests | Update to P×N + variant assertions |
| `src/components/campaigns/creativeGroups.ts` | pure grouping/slot helpers | **Create** — `groupTilesByCreative`, `slotsForTile` |
| `src/components/campaigns/creativeGroups.test.ts` | helper unit tests | **Create** |
| `src/components/campaigns/CampaignCreativeGrid.tsx` | grid + filter pills | Group tiles into creatives |
| `src/components/campaigns/CampaignCreativeRow.tsx` | one creative row | Take a group, render a `VariantThumb` per sibling tile |
| `src/components/campaigns/CampaignDetail.tsx` | detail header | "N creatives" counts groups |
| `e2e/helpers/db.ts` | e2e seeders | Add `seedDoneVariantGroup` |
| `e2e/53-variant-editing.spec.ts` | e2e | **Create** — per-variant edit isolation |

Editor (`CreativeEditor.tsx`), the editor page (`c/[creativeId]/page.tsx`), regenerate route, estimate route, and `tile_versions` are intentionally **unchanged**.

---

## Task 1: Schema — add variant columns to `campaign_tiles`

**Files:**
- Modify: `src/lib/db/schema.ts:213-238` (the `campaignTiles` table)
- Generate: `drizzle/*.sql`

- [ ] **Step 1: Add the two columns + index**

In `src/lib/db/schema.ts`, inside the `campaignTiles` `pgTable` column block, add after the `quantity` line (`quantity: integer('quantity').default(1).notNull(),`):

```ts
    variantGroupId: uuid('variant_group_id'),
    variantIndex: integer('variant_index').default(0).notNull(),
```

Then in the same table's index callback (the `(t) => ({ ... })` block that currently has `campaignIdx` and `workflowIdx`), add:

```ts
    variantGroupIdx: index('campaign_tiles_variant_group_idx').on(
      t.campaignId,
      t.variantGroupId,
      t.variantIndex,
    ),
```

`uuid`, `integer`, and `index` are already imported in this file (used by other tables), so no new imports.

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: drizzle-kit prints a new migration file under `drizzle/` adding `variant_group_id` + `variant_index` + the index. No interactive prompt (pure additive change).

- [ ] **Step 3: Review the generated SQL**

Run: `git status --short drizzle/` then open the new `.sql` file.
Expected: `ALTER TABLE "campaign_tiles" ADD COLUMN "variant_group_id" uuid;`, `ADD COLUMN "variant_index" integer DEFAULT 0 NOT NULL;`, and a `CREATE INDEX ... ON "campaign_tiles" ("campaign_id","variant_group_id","variant_index")`. No DROP / data-loss statements.

- [ ] **Step 4: Apply to dev + test DBs**

Run: `pnpm db:migrate && pnpm test:db:setup`
Expected: both complete without error; `vitrine_test` is rebuilt with the new columns.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (the `$inferSelect`/`$inferInsert` types now include the new columns).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): add variant_group_id + variant_index to campaign_tiles"
```

---

## Task 2: Domain types — carry + persist variant fields

**Files:**
- Modify: `src/lib/campaigns.ts` (`CampaignTile` type ~24-33, `toTile` ~54-65, `CreateCampaignInput` ~91-109, `createCampaign` insert ~130-145)

This task has no standalone unit test (the insert path needs a live DB and is covered by the Task 6 e2e). Verify with `pnpm typecheck`.

- [ ] **Step 1: Extend the `CampaignTile` type**

In `src/lib/campaigns.ts`, change the `CampaignTile` type to add the two fields after `quantity`:

```ts
export type CampaignTile = {
  id: string;
  presetId: PresetId;
  workflowId: string;
  status: TileStatus;
  prompt: string;
  quantity: number;
  variantGroupId: string | null;
  variantIndex: number;
  adCopy: AdCopy | null;
  assetUrl: string | null;
};
```

- [ ] **Step 2: Carry them in `toTile`**

Update `toTile` to map the row columns:

```ts
function toTile(row: CampaignTileRow, assetUrl?: string | null): CampaignTile {
  return {
    id: row.id,
    presetId: row.presetId as PresetId,
    workflowId: row.workflowId,
    status: row.status,
    prompt: row.prompt,
    quantity: row.quantity,
    variantGroupId: row.variantGroupId ?? null,
    variantIndex: row.variantIndex,
    adCopy: (row.adCopy as AdCopy | null) ?? null,
    assetUrl: assetUrl ?? null,
  };
}
```

- [ ] **Step 3: Extend `CreateCampaignInput.tiles[]`**

In the `CreateCampaignInput` type, change the `tiles` array element shape to:

```ts
  tiles: Array<{
    presetId: PresetId;
    workflowId: string;
    prompt: string;
    quantity?: number;
    variantGroupId?: string | null;
    variantIndex?: number;
    adCopy?: AdCopy | null;
  }>;
```

- [ ] **Step 4: Insert them in `createCampaign`**

In `createCampaign`, update the `.values(input.tiles.map(...))` object to include the two columns:

```ts
            input.tiles.map((t) => ({
              campaignId: campaignRow.id,
              presetId: t.presetId,
              workflowId: t.workflowId,
              prompt: t.prompt,
              quantity: t.quantity ?? 1,
              variantGroupId: t.variantGroupId ?? null,
              variantIndex: t.variantIndex ?? 0,
              status: 'cooking' as TileStatus,
              adCopy: t.adCopy ?? null,
            })),
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/campaigns.ts
git commit -m "feat(campaigns): carry + persist variant_group_id/variant_index on tiles"
```

---

## Task 3: Cook route — submit N single-image workflows per preset

**Files:**
- Modify: `src/app/api/campaigns/cook/route.ts`
- Test: `src/app/api/campaigns/cook/route.test.ts`

- [ ] **Step 1: Update the existing cook tests to the new behaviour (write the failing tests)**

In `src/app/api/campaigns/cook/route.test.ts`:

Replace the test `'submits one workflow per preset with quantity = variantsPerPreset'` (asserts 2 submits, `numImages === 2`) with:

```ts
  it('submits one workflow per variant (P × N) with numImages = 1', async () => {
    // validBody: 2 presets, variantsPerPreset: 2 → 4 submits.
    const res = await POST(makeRequest(validBody()) as never);
    expect(res.status).toBe(200);
    expect(submitImageGenMock).toHaveBeenCalledTimes(4);
    for (const call of submitImageGenMock.mock.calls) {
      expect(call[1].numImages).toBe(1);
    }
  });
```

Replace the body of `'persists campaign with referenceAssetIds, variantsPerPreset, enhancedPrompts, tiles'` so the tiles assertions reflect P×N variant rows. Keep the campaign-level assertions; change the tiles block:

```ts
  it('persists campaign with referenceAssetIds, variantsPerPreset, enhancedPrompts, tiles', async () => {
    await POST(
      makeRequest(validBody({ referenceAssetIds: ['a1', 'a2'], variantsPerPreset: 3 })) as never,
    );
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    const input = createCampaignMock.mock.calls[0]![0];
    expect(input.referenceAssetIds).toEqual(['a1', 'a2']);
    expect(input.variantsPerPreset).toBe(3);
    expect(input.enhancedPrompts).toBeDefined();
    expect(input.enhancedPrompts['ig-feed']).toBeDefined();
    expect(input.enhancedPrompts['ig-story']).toBeDefined();

    // 2 presets × 3 variants = 6 tile entries, each quantity 1.
    expect(input.tiles).toHaveLength(6);
    for (const t of input.tiles) {
      expect(t.quantity).toBe(1);
      expect(typeof t.workflowId).toBe('string');
      expect(typeof t.prompt).toBe('string');
      expect(typeof t.variantGroupId).toBe('string');
      expect(t.variantGroupId).toBeTruthy();
      expect(typeof t.variantIndex).toBe('number');
    }

    // Tiles of the same preset share one variant_group_id; variant_index covers 0..N-1.
    const byPreset = new Map<string, Array<{ variantGroupId: string; variantIndex: number }>>();
    for (const t of input.tiles) {
      const arr = byPreset.get(t.presetId) ?? [];
      arr.push({ variantGroupId: t.variantGroupId, variantIndex: t.variantIndex });
      byPreset.set(t.presetId, arr);
    }
    expect([...byPreset.keys()].sort()).toEqual(['ig-feed', 'ig-story']);
    for (const arr of byPreset.values()) {
      expect(arr).toHaveLength(3);
      expect(new Set(arr.map((x) => x.variantGroupId)).size).toBe(1);
      expect(arr.map((x) => x.variantIndex).sort()).toEqual([0, 1, 2]);
    }
    // Different presets get different group ids.
    const groupIds = [...byPreset.values()].map((arr) => arr[0]!.variantGroupId);
    expect(new Set(groupIds).size).toBe(2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit src/app/api/campaigns/cook/route.test.ts`
Expected: FAIL — old code submits 2 (not 4), `numImages === 2`, and tiles lack `variantGroupId`/`variantIndex`.

- [ ] **Step 3: Add the `node:crypto` import**

At the top of `src/app/api/campaigns/cook/route.ts`, add (after the existing imports):

```ts
import { randomUUID } from 'node:crypto';
```

- [ ] **Step 4: Extend the `SubmittedTile` type**

Change the `SubmittedTile` type (currently ~41-49) to:

```ts
type SubmittedTile = {
  presetId: PresetId;
  workflowId: string;
  prompt: string;
  estimatedCost: number;
  input: VitrineImageGenInput;
  enhanced: EnhancedPrompt;
  adCopy: AdCopy | null;
  variantGroupId: string;
  variantIndex: number;
};
```

- [ ] **Step 5: Rewrite the submit fan-out**

Replace the whole `const settled = await Promise.allSettled( brief.presetIds.map(...) )` block (currently ~103-141) with a per-preset prompt build followed by a P×N submit fan-out:

```ts
  // Build each preset's prompt + ad copy ONCE, then fan out N single-image
  // submits per preset. Each variant becomes its own quantity-1 tile sharing a
  // variant_group_id, so it can be edited / regenerated independently.
  const perPreset = brief.presetIds.map((id) => {
    const preset = PRESETS[id];
    const adCopy = adCopyMap[id] ?? null;
    const provided = clientEnhanced?.[id];
    const enhanced: EnhancedPrompt = buildCampaignPrompt({
      brief,
      brand,
      preset,
      referenceCount: refUrls.length,
      adCopy,
      ...(provided?.userOverride ? { userOverride: provided.userOverride } : {}),
    });
    const finalPrompt = resolveFinalPrompt(enhanced);
    const input: VitrineImageGenInput = {
      prompt: finalPrompt,
      aspectRatio: enhanced.aspectRatio,
      numImages: 1,
      ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
      ...(refUrls.length > 0 ? { images: refUrls } : {}),
    };
    return { id, adCopy, enhanced, finalPrompt, input, variantGroupId: randomUUID() };
  });

  // Flat list of (preset, variantIndex) submit jobs, preserving order so the
  // settled results line up with `submitMeta`.
  const submitMeta: Array<{ presetId: PresetId; variantIndex: number }> = [];
  const submitPromises: Array<Promise<SubmittedTile>> = [];
  for (const p of perPreset) {
    for (let v = 0; v < variantsPerPreset; v++) {
      submitMeta.push({ presetId: p.id, variantIndex: v });
      submitPromises.push(
        (async (): Promise<SubmittedTile> => {
          const submit = await submitImageGen(session, p.input);
          return {
            presetId: p.id,
            workflowId: submit.id,
            prompt: p.finalPrompt,
            estimatedCost: submit.cost?.total ?? 0,
            input: p.input,
            enhanced: p.enhanced,
            adCopy: p.adCopy,
            variantGroupId: p.variantGroupId,
            variantIndex: v,
          };
        })(),
      );
    }
  }
  const settled = await Promise.allSettled(submitPromises);
```

- [ ] **Step 6: Update the success/failure aggregation to use `submitMeta`**

Replace the `for (let i = 0; i < settled.length; i++) { ... }` loop (currently ~145-158) with:

```ts
  const successes: SubmittedTile[] = [];
  const failures: Array<{ presetId: PresetId; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const presetId = submitMeta[i]!.presetId;
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      const reason: unknown = r.reason;
      failures.push({
        presetId,
        error: reason instanceof OrchestratorError ? 'orchestrator_error' : 'submit_failed',
        status: reason instanceof OrchestratorError ? reason.status : undefined,
      });
    }
  }
```

- [ ] **Step 7: Pass variant fields into `createCampaign` tiles**

In the `createCampaign({ ... })` call, change the `tiles:` mapper (currently ~179-185) to:

```ts
    tiles: successes.map((r) => ({
      presetId: r.presetId,
      workflowId: r.workflowId,
      prompt: r.prompt,
      quantity: 1,
      variantGroupId: r.variantGroupId,
      variantIndex: r.variantIndex,
      adCopy: r.adCopy,
    })),
```

Leave `presetIds: successes.map((r) => r.presetId)` as-is — `createCampaign` stores it on the campaign row; duplicates across variants are harmless, but de-dupe for cleanliness by changing it to:

```ts
    presetIds: [...new Set(successes.map((r) => r.presetId))],
```

The `enhancedRecord` loop (`for (const r of successes) enhancedRecord[r.presetId] = r.enhanced;`) already de-dupes by key — leave it. The audit-writes `Promise.all(successes.map(...))` block already keys generations off `workflowId` — leave it.

- [ ] **Step 8: Run the cook tests**

Run: `pnpm test:unit src/app/api/campaigns/cook/route.test.ts`
Expected: PASS (all cook tests, including the two rewritten ones and the unchanged reference-URL / userOverride / failure tests).

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/campaigns/cook/route.ts src/app/api/campaigns/cook/route.test.ts
git commit -m "feat(campaigns): cook one quantity-1 tile per variant, grouped"
```

---

## Task 4: Grouping helpers + grid + row rework

**Files:**
- Create: `src/components/campaigns/creativeGroups.ts`
- Create: `src/components/campaigns/creativeGroups.test.ts`
- Modify: `src/components/campaigns/CampaignCreativeGrid.tsx`
- Modify: `src/components/campaigns/CampaignCreativeRow.tsx`

### 4a — pure helpers (TDD)

- [ ] **Step 1: Write the failing helper tests**

Create `src/components/campaigns/creativeGroups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { CampaignTile } from '@/lib/campaigns';
import { groupTilesByCreative, slotsForTile } from './creativeGroups';

function tile(over: Partial<CampaignTile>): CampaignTile {
  return {
    id: 'id',
    presetId: 'ig-feed',
    workflowId: 'wf',
    status: 'done',
    prompt: 'p',
    quantity: 1,
    variantGroupId: null,
    variantIndex: 0,
    adCopy: null,
    assetUrl: null,
    ...over,
  };
}

describe('groupTilesByCreative', () => {
  it('groups sibling tiles by variantGroupId, ordered by variantIndex', () => {
    const tiles = [
      tile({ id: 't1', variantGroupId: 'g1', variantIndex: 1 }),
      tile({ id: 't0', variantGroupId: 'g1', variantIndex: 0 }),
      tile({ id: 't2', variantGroupId: 'g1', variantIndex: 2 }),
    ];
    const groups = groupTilesByCreative(tiles);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('g1');
    expect(groups[0]!.presetId).toBe('ig-feed');
    expect(groups[0]!.tiles.map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  });

  it('treats a NULL-group (legacy) tile as its own group keyed by tile id', () => {
    const tiles = [tile({ id: 'legacy', variantGroupId: null, quantity: 4 })];
    const groups = groupTilesByCreative(tiles);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('legacy');
  });

  it('preserves first-appearance order across groups', () => {
    const tiles = [
      tile({ id: 'a', variantGroupId: 'gB', presetId: 'ig-story' }),
      tile({ id: 'b', variantGroupId: 'gA', presetId: 'ig-feed' }),
    ];
    const groups = groupTilesByCreative(tiles);
    expect(groups.map((g) => g.key)).toEqual(['gB', 'gA']);
  });
});

describe('slotsForTile', () => {
  it('returns 1 for a grouped (new) variant tile regardless of loaded urls', () => {
    expect(slotsForTile(tile({ variantGroupId: 'g1', quantity: 1 }), 0)).toBe(1);
    expect(slotsForTile(tile({ variantGroupId: 'g1', quantity: 1 }), 1)).toBe(1);
  });

  it('returns quantity for a legacy tile before urls arrive', () => {
    expect(slotsForTile(tile({ variantGroupId: null, quantity: 4 }), 0)).toBe(4);
  });

  it('expands to the loaded url count when it exceeds quantity (legacy)', () => {
    expect(slotsForTile(tile({ variantGroupId: null, quantity: 1 }), 3)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit src/components/campaigns/creativeGroups.test.ts`
Expected: FAIL — `creativeGroups.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/components/campaigns/creativeGroups.ts`:

```ts
import type { CampaignTile } from '@/lib/campaigns';
import type { PresetId } from '@/lib/presets';

/** One creative = a group of sibling variant tiles sharing a variant_group_id. */
export type CreativeGroup = {
  /** variantGroupId, or the tile id for legacy NULL-group tiles. */
  key: string;
  presetId: PresetId;
  tiles: CampaignTile[];
};

/**
 * Group tiles into creatives. New cooks produce N sibling tiles sharing a
 * `variantGroupId`; legacy tiles (NULL group) become a group of one keyed by
 * their own id. Group order follows first appearance; tiles within a group are
 * ordered by `variantIndex`.
 */
export function groupTilesByCreative(tiles: CampaignTile[]): CreativeGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, CampaignTile[]>();
  for (const t of tiles) {
    const key = t.variantGroupId ?? t.id;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(t);
  }
  return order.map((key) => {
    const groupTiles = byKey
      .get(key)!
      .slice()
      .sort((a, b) => a.variantIndex - b.variantIndex);
    return { key, presetId: groupTiles[0]!.presetId, tiles: groupTiles };
  });
}

/**
 * How many image slots a single tile renders. A grouped (new) variant tile is
 * always one image. A legacy tile renders `quantity` slots, expanding if the
 * live workflow returns more images than expected.
 */
export function slotsForTile(
  tile: Pick<CampaignTile, 'variantGroupId' | 'quantity'>,
  loadedUrlCount: number,
): number {
  if (tile.variantGroupId != null) return 1;
  return Math.max(tile.quantity ?? 1, loadedUrlCount || 1);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit src/components/campaigns/creativeGroups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/creativeGroups.ts src/components/campaigns/creativeGroups.test.ts
git commit -m "feat(campaigns): add pure variant grouping + slot helpers"
```

### 4b — grid groups into creatives

- [ ] **Step 6: Rewrite `CampaignCreativeGrid` to group tiles**

Replace the whole body of `src/components/campaigns/CampaignCreativeGrid.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { PRESETS } from '@/lib/presets';
import type { CampaignTile } from '@/lib/campaigns';
import type { PresetId } from '@/lib/presets';
import { CampaignCreativeRow } from './CampaignCreativeRow';
import { groupTilesByCreative } from './creativeGroups';
import { FilterPills, type FilterOption } from './FilterPills';

type Props = {
  campaignId: string;
  tiles: CampaignTile[];
};

export function CampaignCreativeGrid({ campaignId, tiles }: Props) {
  const [activeFilter, setActiveFilter] = useState('all');

  const groups = groupTilesByCreative(tiles);

  // Build filter options: 'all' first, then one per preset present in the
  // creative groups (in order of first appearance). Counts are per creative,
  // not per variant tile.
  const seenPresets: PresetId[] = [];
  for (const g of groups) {
    if (!seenPresets.includes(g.presetId)) seenPresets.push(g.presetId);
  }

  const options: FilterOption[] = [
    { key: 'all', label: 'all', count: groups.length },
    ...seenPresets.map((presetId) => ({
      key: presetId,
      label: PRESETS[presetId].label,
      count: groups.filter((g) => g.presetId === presetId).length,
    })),
  ];

  return (
    <>
      {seenPresets.length > 1 && (
        <FilterPills
          options={options}
          active={activeFilter}
          onChange={setActiveFilter}
          className="mb-4"
        />
      )}

      <div className="flex flex-col">
        {groups.map((group) => {
          // Keep the row mounted even when filtered out — it polls live
          // workflows. Toggle visibility via CSS only so polling stays alive.
          const visible = activeFilter === 'all' || group.presetId === activeFilter;
          return (
            <div key={group.key} className={visible ? '' : 'hidden'}>
              <CampaignCreativeRow campaignId={campaignId} group={group} />
            </div>
          );
        })}
      </div>
    </>
  );
}
```

### 4c — row renders a thumb per sibling tile

- [ ] **Step 7: Rewrite `CampaignCreativeRow` to take a group**

Replace the whole contents of `src/components/campaigns/CampaignCreativeRow.tsx` with the following. It keeps the existing `RowImage` presentation (edit / download / regenerate menu) verbatim and adds a `VariantThumb` child that owns one tile's workflow poll. The row header is now per-creative (preset label + ratio); per-image download + regenerate live in each thumb's menu (so regenerate is naturally per-variant).

```tsx
'use client';

import { Download, MoreVertical, Pencil, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CampaignTile } from '@/lib/campaigns';
import { PRESETS } from '@/lib/presets';
import type { CreativeGroup } from './creativeGroups';
import { slotsForTile } from './creativeGroups';
import { useTileWorkflow } from './useTileWorkflow';

type Props = { campaignId: string; group: CreativeGroup };

export function CampaignCreativeRow({ campaignId, group }: Props) {
  const preset = PRESETS[group.presetId];

  return (
    <section data-testid="campaign-creative-row" className="border-b border-line-subtle py-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[15px] font-semibold text-fg-0">{preset.label}</span>
        <span className="font-mono text-[11px] text-fg-3">{preset.ratio}</span>
        <span className="font-mono text-[11px] text-fg-3">
          {group.tiles.length} {group.tiles.length === 1 ? 'variant' : 'variants'}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {group.tiles.map((tile) => (
          <VariantThumb key={tile.id} campaignId={campaignId} tile={tile} />
        ))}
      </div>
    </section>
  );
}

/**
 * Renders one tile's image(s) and owns its live workflow poll. A grouped (new)
 * variant tile renders a single image linking to its own editor. A legacy tile
 * renders its `quantity` images, each linking to the same editor with `?v=<i>`
 * (handled by the editor's `initialVariant`).
 */
function VariantThumb({ campaignId, tile }: { campaignId: string; tile: CampaignTile }) {
  const preset = PRESETS[tile.presetId];
  const { imageUrls, setWorkflowId } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
  });
  const [regenerating, setRegenerating] = useState(false);
  const base = `/campaigns/${campaignId}/c/${tile.id}`;
  const slots = slotsForTile(tile, imageUrls.length);

  async function redo() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { workflowId?: string };
      if (res.ok && data.workflowId) setWorkflowId(data.workflowId);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      {Array.from({ length: slots }).map((_, i) => (
        <RowImage
          key={i}
          url={imageUrls[i] ?? null}
          editHref={i === 0 ? base : `${base}?v=${i}`}
          ratio={preset.width / preset.height}
          filename={`${preset.id}-${tile.id}-${i}`}
          onRegenerate={redo}
          regenerating={regenerating}
        />
      ))}
    </>
  );
}

function RowImage({
  url,
  editHref,
  ratio,
  filename,
  onRegenerate,
  regenerating,
}: {
  url: string | null;
  editHref: string;
  ratio: number;
  filename: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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
      style={{ width: 150, aspectRatio: ratio }}
    >
      {url ? (
        <Link href={editHref} aria-label="edit creative">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </Link>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-bg-3" data-testid="row-image-skeleton" />
      )}
      {url && (
        <div ref={menuRef} className="absolute right-1.5 top-1.5">
          <button
            type="button"
            data-testid="row-image-menu"
            aria-label="image options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-6 place-items-center rounded-[6px] bg-black/55 text-white backdrop-blur-md"
          >
            <MoreVertical size={13} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-[8px] border border-line-subtle bg-bg-1 py-1 shadow-lg"
            >
              <Link
                role="menuitem"
                href={editHref}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <Pencil size={12} strokeWidth={1.75} /> edit
              </Link>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  downloadOne();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2"
              >
                <Download size={12} strokeWidth={1.75} /> download
              </button>
              <button
                role="menuitem"
                type="button"
                disabled={regenerating}
                onClick={() => {
                  onRegenerate();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-fg-1 hover:bg-bg-2 disabled:opacity-40"
              >
                <RefreshCw
                  size={12}
                  strokeWidth={1.75}
                  className={regenerating ? 'animate-spin' : ''}
                />{' '}
                regenerate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (The grid no longer passes `tile=`; it passes `group=`. `downloadImagesAsZip` is no longer imported in the row — confirm no unused-import error.)

- [ ] **Step 9: Run the full unit suite**

Run: `pnpm test:unit`
Expected: PASS — including `creativeGroups.test.ts`, the cook tests, and the existing `CreativeEditor.test.ts` (`pickCanvasImageUrl`, untouched).

- [ ] **Step 10: Commit**

```bash
git add src/components/campaigns/CampaignCreativeGrid.tsx src/components/campaigns/CampaignCreativeRow.tsx
git commit -m "feat(campaigns): render one editable thumbnail per variant tile"
```

---

## Task 5: Campaign detail counts creatives, not variant tiles

**Files:**
- Modify: `src/components/campaigns/CampaignDetail.tsx`

- [ ] **Step 1: Compute the creative-group count**

In `src/components/campaigns/CampaignDetail.tsx`, add an import:

```tsx
import { groupTilesByCreative } from './creativeGroups';
```

Then inside the `CampaignDetail` component, after the existing `const doneCount = ...` / `const isCooking = ...` lines, add:

```tsx
  const creativeCount = groupTilesByCreative(campaign.tiles).length;
```

- [ ] **Step 2: Use it in the header eyebrow + section head**

Replace `{campaign.tiles.length} creatives` (in the `t-eyebrow` span) with `{creativeCount} creatives`.

Replace the `SectionHead` `count={`${campaign.tiles.length}`}` prop with `count={`${creativeCount}`}`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/campaigns/CampaignDetail.tsx
git commit -m "feat(campaigns): count creatives by group, not variant tiles"
```

---

## Task 6: e2e — per-variant edit isolation

**Files:**
- Modify: `e2e/helpers/db.ts`
- Create: `e2e/53-variant-editing.spec.ts`

- [ ] **Step 1: Add a grouped-variant seeder**

In `e2e/helpers/db.ts`, after `seedDoneCampaign` (ends ~315), add:

```ts
/**
 * Seed a campaign with ONE creative made of `variantCount` sibling tiles
 * sharing a variant_group_id (each quantity 1, its own asset + workflow + a
 * single tile_versions row). Mirrors the post-cook state of the new
 * per-variant model. Returns the campaign id, the shared group id, and the
 * tile ids ordered by variant_index.
 */
export async function seedDoneVariantGroup(
  variantCount = 3,
  userId: string = TEST_USER_ID,
): Promise<{ id: string; groupId: string; tileIds: string[] }> {
  const pool = getPool();
  const presetId = 'ig-story';

  await pool.query(
    `INSERT INTO users (id, civitai_id, username, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [userId, Number.isFinite(Number(userId)) ? Number(userId) : null, null],
  );

  const campaignRes = await pool.query<{ id: string }>(
    `INSERT INTO campaigns (user_id, title, brief, preset_ids, estimated_buzz)
     VALUES ($1, 'e2e variant campaign', '{}'::jsonb, ARRAY[$2]::text[], 60)
     RETURNING id`,
    [userId, presetId],
  );
  const id = campaignRes.rows[0]!.id;

  const groupRes = await pool.query<{ g: string }>(`SELECT gen_random_uuid() AS g`);
  const groupId = groupRes.rows[0]!.g;

  const tileIds: string[] = [];
  for (let v = 0; v < variantCount; v++) {
    const assetId = await seedAsset({ kind: 'generated' }, userId);
    const workflowId = `e2e-variant-wf-${id}-${v}`;
    const prompt = `e2e variant prompt ${v}`;
    const adCopy = { headline: `variant ${v}`, subhead: 'sub', cta: 'shop now' };
    const tileRes = await pool.query<{ id: string }>(
      `INSERT INTO campaign_tiles
         (campaign_id, preset_id, workflow_id, prompt, status, ad_copy, asset_id,
          quantity, variant_group_id, variant_index, estimated_buzz)
       VALUES ($1, $2, $3, $4, 'done'::tile_status, $5::jsonb, $6, 1, $7, $8, 20)
       RETURNING id`,
      [id, presetId, workflowId, prompt, JSON.stringify(adCopy), assetId, groupId, v],
    );
    const tileId = tileRes.rows[0]!.id;
    tileIds.push(tileId);
    await pool.query(
      `INSERT INTO tile_versions
         (tile_id, version, workflow_id, prompt, ad_copy, asset_id, change_note)
       VALUES ($1, 1, $2, $3, $4::jsonb, $5, 'cooked')`,
      [tileId, workflowId, prompt, JSON.stringify(adCopy), assetId],
    );
  }

  return { id, groupId, tileIds };
}
```

`seedAsset`, `getPool`, `TEST_USER_ID` are already defined/used above in this file.

- [ ] **Step 2: Write the e2e spec**

Create `e2e/53-variant-editing.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { signInToApp } from './helpers/auth';
import {
  countTileVersions,
  markOnboardingComplete,
  resetUserData,
  seedDoneVariantGroup,
} from './helpers/db';

test.describe('per-variant editing', () => {
  test.beforeEach(async () => {
    await resetUserData();
    await markOnboardingComplete();
  });

  test('the detail page shows one row of N editable variant thumbnails', async ({
    page,
    baseURL,
  }) => {
    const { id, tileIds } = await seedDoneVariantGroup(3);
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/${id}`);

    // One creative row, three variant thumbnails (each an "edit creative" link).
    await expect(page.getByTestId('campaign-creative-row')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'edit creative' })).toHaveCount(3);

    // Each thumbnail links to its OWN tile editor.
    const hrefs = await page
      .getByRole('link', { name: 'edit creative' })
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')));
    for (const tileId of tileIds) {
      expect(hrefs.some((h) => h?.includes(`/c/${tileId}`))).toBe(true);
    }
  });

  test('editing one variant writes a version only for that variant', async ({ page, baseURL }) => {
    const { id, tileIds } = await seedDoneVariantGroup(3);
    const [tile0, tile1] = tileIds;
    await signInToApp(page, baseURL!);

    // Open variant #1's editor directly.
    await page.goto(`${baseURL}/campaigns/${id}/c/${tile1}`);
    await expect(page.getByTestId('creative-editor')).toBeVisible({ timeout: 15_000 });

    expect(await countTileVersions(tile1!)).toBe(1);
    expect(await countTileVersions(tile0!)).toBe(1);

    const headerField = page.getByTestId('editor-field-header');
    await headerField.clear();
    await headerField.fill('variant one edited');
    await page.getByTestId('editor-save').click();
    await page.waitForResponse(
      (r) => r.url().includes(`/tiles/${tile1}`) && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 15_000 },
    );

    // Only variant #1 gains a new version; its sibling is untouched.
    expect(await countTileVersions(tile1!)).toBe(2);
    expect(await countTileVersions(tile0!)).toBe(1);
  });
});
```

- [ ] **Step 3: Ensure the test DB has the new columns**

Run: `pnpm test:db:setup`
Expected: completes without error (idempotent; confirms `vitrine_test` has `variant_group_id`/`variant_index`).

- [ ] **Step 4: Run the new e2e spec**

Run: `pnpm test:e2e e2e/53-variant-editing.spec.ts`
Expected: PASS — both tests. (Civitai dev server is already up; MSW mocks the orchestrator.)

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/db.ts e2e/53-variant-editing.spec.ts
git commit -m "test(e2e): per-variant edit isolation + grouped variant seeder"
```

---

## Task 7: Full verification + export route check

**Files:**
- Inspect: `src/app/api/campaigns/[id]/export/route.ts` (+ its `.test.ts`)

- [ ] **Step 1: Verify the export route handles grouped tiles**

Read `src/app/api/campaigns/[id]/export/route.ts`. It iterates `campaign.tiles` to bundle assets. With the new model there are simply more tiles (one per variant), each with its own `assetId` — confirm it does not assume one tile per preset or dedupe by preset in a way that drops variants. If it labels files by preset only, make filenames unique by including `tile.variantIndex` (or `tile.id`) so variant images don't collide in the archive.

If a change is needed, make it minimal and re-run: `pnpm test:unit src/app/api/campaigns/[id]/export/route.test.ts`. If no change is needed, note that in the commit for Step 4 or skip committing.

- [ ] **Step 2: Run the full unit suite**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS.

- [ ] **Step 4: Run the campaign + editor e2e specs**

Run: `pnpm test:e2e e2e/50-campaigns.spec.ts e2e/52-creative-editor.spec.ts e2e/53-variant-editing.spec.ts`
Expected: PASS. (50-campaigns cooks a 2-variant campaign end-to-end through the new fan-out; 52 covers the unchanged single-tile editor; 53 covers per-variant isolation.)

- [ ] **Step 5: Commit any export-route fix**

```bash
git add -A
git commit -m "fix(campaigns): keep export filenames unique across variants"
```

(Skip if Step 1 required no change.)

---

## Self-Review notes

- **Spec coverage:** schema (T1), cook P×N + grouping fields (T2–T3), read grouping + grid/row (T4), creative count (T5), per-variant version isolation + testing (T6), export risk + full verification (T7). Editor/regenerate/estimate "unchanged" verified by reuse + the unchanged `52-creative-editor` spec and `pickCanvasImageUrl` tests. "No migration" honored — legacy NULL-group path exercised by `slotsForTile`/grouping tests.
- **Legacy `?v=` path:** retained — `VariantThumb` emits `?v=<i>` for slots `>0`, consumed by the editor's existing `initialVariant`/`pickCanvasImageUrl` (untouched). New grouped tiles always render 1 slot → `?v=0` → `base`.
- **Type consistency:** `CreativeGroup` (`key`, `presetId`, `tiles`), `groupTilesByCreative`, `slotsForTile`, `SubmittedTile.variantGroupId/variantIndex`, and `CampaignTile.variantGroupId/variantIndex` names are used identically across Tasks 2–6.
