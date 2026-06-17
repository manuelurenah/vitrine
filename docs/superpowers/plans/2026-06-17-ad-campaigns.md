# Ad Campaigns (Civitai Ads) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users generate ready-to-upload Civitai-ad creatives at the platform's exact pixel sizes (320×50, 728×90, 970×90, 300×250, 970×250, 300×600), as a third sibling feature beside campaigns/photoshoots.

**Architecture:** Generate one branded creative per selected ad size at the nearest supported aspect ratio (`1:1|4:5|9:16|16:9`, `resolution:'2K'`), then crop server-side with `sharp` (`fit:'cover'`) to the exact pixel size on download/export. New `ad_campaigns`/`ad_campaign_tiles` tables + `/ads` routes + `components/ads/*`; all shared plumbing (brand, orchestrator, generations/buzz audit, asset sync, workflow polling) reused, with two surgical extensions to `assets.ts` and one enum value added to `generation_source`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle/Postgres, `@civitai/app-sdk` orchestrator, `sharp` (new), existing `src/lib/zip.ts`, Vitest, Playwright + MSW.

**Spec:** `docs/superpowers/specs/2026-06-17-ad-campaigns-design.md`

**Conventions for every task:** run from repo root `/Users/hackstreetboy/Projects/vitrine`; package manager is `pnpm`; lowercase commit subjects; do NOT switch branches (stay on `feat/ad-campaigns`).

---

## Task 1: Add the `sharp` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `pnpm add sharp`
Expected: `package.json` gains `"sharp"` under dependencies; lockfile updates.

- [ ] **Step 2: Verify it loads**

Run: `node -e "const s=require('sharp'); console.log('sharp', require('sharp/package.json').version)"`
Expected: prints `sharp <version>` with no throw.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(ads): add sharp for exact-pixel ad crops"
```

---

## Task 2: Ad-format catalog (`adFormats.ts`)

Pure module, no `server-only` import (must be importable by client pickers and node tests). Encodes the request JSON, flattens to 6 unique sizes, maps each to the nearest generation aspect ratio.

**Files:**
- Create: `src/lib/adFormats.ts`
- Test: `src/lib/adFormats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/adFormats.test.ts
import { describe, expect, it } from 'vitest';
import {
  AD_FORMATS,
  AD_SIZE_LIST,
  AD_SIZES,
  isAdSizeId,
  nearestAspect,
  recommendedAdSizeIds,
} from './adFormats';

describe('nearestAspect', () => {
  it('maps each ad ratio to the closest allowed aspect ratio', () => {
    expect(nearestAspect(320, 50)).toBe('16:9');
    expect(nearestAspect(728, 90)).toBe('16:9');
    expect(nearestAspect(970, 90)).toBe('16:9');
    expect(nearestAspect(970, 250)).toBe('16:9');
    expect(nearestAspect(300, 250)).toBe('1:1'); // 1.2 is closer to 1:1 than 4:5
    expect(nearestAspect(300, 600)).toBe('9:16');
  });
});

describe('AD_FORMATS', () => {
  it('encodes the four request formats verbatim', () => {
    expect(AD_FORMATS.map((f) => f.name)).toEqual([
      'Footer',
      'Banner',
      'Rectangle',
      'Skyscraper',
    ]);
    const footer = AD_FORMATS.find((f) => f.name === 'Footer')!;
    expect(footer.sizes.mobile).toEqual([[320, 50]]);
    expect(footer.sizes.desktop).toEqual([
      [728, 90],
      [970, 90],
    ]);
  });
});

describe('AD_SIZES', () => {
  it('flattens to exactly six unique pixel sizes', () => {
    const dims = AD_SIZE_LIST.map((s) => `${s.width}x${s.height}`).sort();
    expect(dims).toEqual(['300x250', '300x600', '320x50', '728x90', '970x250', '970x90']);
  });

  it('tags a shared size with every format that uses it', () => {
    const rect = AD_SIZE_LIST.find((s) => s.width === 300 && s.height === 250)!;
    expect(rect.formats.sort()).toEqual(['Banner', 'Rectangle']);
    const leaderboard = AD_SIZE_LIST.find((s) => s.width === 728 && s.height === 90)!;
    expect(leaderboard.formats.sort()).toEqual(['Banner', 'Footer']);
  });

  it('assigns each size the nearest generation aspect ratio', () => {
    const lb = AD_SIZES[Object.keys(AD_SIZES).find((k) => AD_SIZES[k]!.width === 728)!]!;
    expect(lb.aspectRatio).toBe('16:9');
  });

  it('has stable ids that round-trip through isAdSizeId', () => {
    for (const s of AD_SIZE_LIST) expect(isAdSizeId(s.id)).toBe(true);
    expect(isAdSizeId('nope')).toBe(false);
  });
});

describe('recommendedAdSizeIds', () => {
  it('returns a non-empty subset of real size ids', () => {
    const rec = recommendedAdSizeIds();
    expect(rec.length).toBeGreaterThan(0);
    for (const id of rec) expect(isAdSizeId(id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/adFormats.test.ts`
Expected: FAIL (module `./adFormats` not found).

- [ ] **Step 3: Implement the module**

```ts
// src/lib/adFormats.ts
import type { AspectRatio } from './promptBuilder';

export type AdDevice = 'mobile' | 'desktop' | 'any';
export type AdSizeId = string;

export type AdFormatDef = {
  name: 'Footer' | 'Banner' | 'Rectangle' | 'Skyscraper';
  sizes: Partial<Record<AdDevice, [number, number][]>>;
};

/** Verbatim from civitai-ad-campaign-support.md. */
export const AD_FORMATS: AdFormatDef[] = [
  { name: 'Footer', sizes: { mobile: [[320, 50]], desktop: [[728, 90], [970, 90]] } },
  { name: 'Banner', sizes: { mobile: [[300, 250]], desktop: [[728, 90], [970, 250]] } },
  { name: 'Rectangle', sizes: { any: [[300, 250]] } },
  { name: 'Skyscraper', sizes: { any: [[300, 600]] } },
];

const ALLOWED: { ar: AspectRatio; r: number }[] = [
  { ar: '1:1', r: 1 },
  { ar: '4:5', r: 4 / 5 },
  { ar: '9:16', r: 9 / 16 },
  { ar: '16:9', r: 16 / 9 },
];

/** Pick the allowed generation aspect ratio nearest (by |ratio diff|) to w/h. */
export function nearestAspect(w: number, h: number): AspectRatio {
  const target = w / h;
  let best = ALLOWED[0]!;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const c of ALLOWED) {
    const diff = Math.abs(target - c.r);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best.ar;
}

export type AdSizeDef = {
  id: AdSizeId;
  label: string;
  formats: string[];
  width: number;
  height: number;
  ratio: string;
  aspectRatio: AspectRatio;
  styleNotes: string;
};

const SIZE_SLUG: Record<string, string> = {
  '320x50': 'mobile-leaderboard',
  '728x90': 'leaderboard',
  '970x90': 'large-leaderboard',
  '300x250': 'medium-rectangle',
  '970x250': 'billboard',
  '300x600': 'half-page',
};

const SIZE_NAME: Record<string, string> = {
  '320x50': 'Mobile leaderboard',
  '728x90': 'Leaderboard',
  '970x90': 'Large leaderboard',
  '300x250': 'Medium rectangle',
  '970x250': 'Billboard',
  '300x600': 'Half-page',
};

function styleNotesFor(w: number, h: number): string {
  const r = w / h;
  if (r >= 4)
    return 'ultra-wide leaderboard ad strip; keep the product/subject and any copy inside a centered horizontal safe band, simple uncluttered background that stays legible when cropped to a thin horizontal strip, generous horizontal bleed';
  if (r > 1.4)
    return 'wide billboard ad; key subject centered with a strong horizontal composition, clean background, leave bleed at top and bottom for cropping';
  if (r < 0.7)
    return 'tall skyscraper ad; vertical composition with the subject centered, stacked layout, leave bleed at the left and right edges for cropping';
  return 'medium rectangle ad; balanced centered composition with the product as a clear hero, modest margins on all sides for cropping';
}

function buildSizes(): Record<AdSizeId, AdSizeDef> {
  const byDim = new Map<string, { w: number; h: number; formats: Set<string> }>();
  for (const f of AD_FORMATS) {
    for (const dims of Object.values(f.sizes)) {
      for (const [w, h] of dims ?? []) {
        const key = `${w}x${h}`;
        const entry = byDim.get(key) ?? { w, h, formats: new Set<string>() };
        entry.formats.add(f.name);
        byDim.set(key, entry);
      }
    }
  }
  const out: Record<AdSizeId, AdSizeDef> = {};
  for (const { w, h, formats } of byDim.values()) {
    const key = `${w}x${h}`;
    const id = `${SIZE_SLUG[key]}-${key}`;
    out[id] = {
      id,
      label: `${SIZE_NAME[key]} · ${w}×${h}`,
      formats: [...formats],
      width: w,
      height: h,
      ratio: `${w}:${h}`,
      aspectRatio: nearestAspect(w, h),
      styleNotes: styleNotesFor(w, h),
    };
  }
  return out;
}

export const AD_SIZES: Record<AdSizeId, AdSizeDef> = buildSizes();
export const AD_SIZE_LIST: AdSizeDef[] = Object.values(AD_SIZES);

export function isAdSizeId(v: string): v is AdSizeId {
  return v in AD_SIZES;
}

/** Default selection: one of each common shape (rectangle, leaderboard, skyscraper, billboard). */
export function recommendedAdSizeIds(): AdSizeId[] {
  return [
    'medium-rectangle-300x250',
    'leaderboard-728x90',
    'half-page-300x600',
    'billboard-970x250',
  ];
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/adFormats.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adFormats.ts src/lib/adFormats.test.ts
git commit -m "feat(ads): ad-format catalog with nearest-aspect mapping"
```

---

## Task 3: Server-side exact-pixel crop (`adExport.ts`)

**Files:**
- Create: `src/lib/adExport.ts`
- Test: `src/lib/adExport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/adExport.test.ts
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cropToExactPng } from './adExport';

async function solidPng(w: number, h: number): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

describe('cropToExactPng', () => {
  it('produces an image at exactly the target pixel size (extreme landscape)', async () => {
    const src = await solidPng(2048, 1152); // 16:9 source
    const out = await cropToExactPng(src, 728, 90);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(728);
    expect(meta.height).toBe(90);
    expect(meta.format).toBe('png');
  });

  it('handles portrait targets', async () => {
    const src = await solidPng(1152, 2048); // 9:16 source
    const out = await cropToExactPng(src, 300, 600);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(600);
  });

  it('handles square-ish targets', async () => {
    const src = await solidPng(1024, 1024);
    const out = await cropToExactPng(src, 300, 250);
    const meta = await sharp(Buffer.from(out)).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(250);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/adExport.test.ts`
Expected: FAIL (`./adExport` has no `cropToExactPng`).

- [ ] **Step 3: Implement**

```ts
// src/lib/adExport.ts
import 'server-only';
import sharp from 'sharp';

/**
 * Center-crop + scale an image to EXACTLY width×height pixels. `fit:'cover'`
 * fills the target rectangle (cropping the overflow), `position:'centre'` keeps
 * the middle band — the right behaviour for ad creatives composed center-safe.
 */
export async function cropToExactPng(
  bytes: Uint8Array | ArrayBuffer,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const out = await sharp(buf)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
```

> Note: `vitest` runs in node, so the `server-only` import resolves to a no-op outside a client bundle. If the test runner rejects `server-only`, the project's vitest config already handles server modules (other server libs import it); if not, the failing import will surface here — fix by confirming vitest `server` conditions, do NOT delete the guard.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/adExport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adExport.ts src/lib/adExport.test.ts
git commit -m "feat(ads): server-side exact-pixel crop via sharp"
```

---

## Task 4: Ad prompt builder (`buildAdPrompt`)

Extend `src/lib/promptBuilder.ts`. Mirrors `buildCampaignPrompt` but keyed off `AdSizeDef`, passes the pre-mapped aspect ratio, and adds crop-safe composition guidance.

**Files:**
- Modify: `src/lib/promptBuilder.ts` (append; do not touch existing exports)
- Test: `src/lib/promptBuilder.adprompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/promptBuilder.adprompt.test.ts
import { describe, expect, it } from 'vitest';
import { AD_SIZES } from './adFormats';
import { buildAdPrompt } from './promptBuilder';

const leaderboard = AD_SIZES['leaderboard-728x90']!;
const rectangle = AD_SIZES['medium-rectangle-300x250']!;

const brief = {
  title: 'Spring sale',
  description: 'A bright bottle of cold brew on a kitchen counter',
  goal: 'drive signups',
  offer: '20% off',
  prompt: '',
};

describe('buildAdPrompt', () => {
  it('passes through the size aspect ratio for generation', () => {
    expect(buildAdPrompt({ brief, size: leaderboard }).aspectRatio).toBe('16:9');
    expect(buildAdPrompt({ brief, size: rectangle }).aspectRatio).toBe('1:1');
  });

  it('references the exact pixel size and crop-safe intent', () => {
    const p = buildAdPrompt({ brief, size: leaderboard }).finalPrompt.toLowerCase();
    expect(p).toContain('728');
    expect(p).toContain('90');
    expect(p).toContain('crop');
  });

  it('uses the no-text negative prompt when no ad copy is supplied', () => {
    const p = buildAdPrompt({ brief, size: rectangle });
    expect(p.negativePrompt).toContain('text overlay');
  });

  it('bakes ad copy and switches the negative prompt when copy is supplied', () => {
    const p = buildAdPrompt({
      brief,
      size: rectangle,
      adCopy: { headline: 'Cold brew, hot deal', subhead: 'Fresh every morning', cta: 'Shop now' },
    });
    expect(p.finalPrompt).toContain('Cold brew, hot deal');
    expect(p.negativePrompt).toContain('misspelled');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/promptBuilder.adprompt.test.ts`
Expected: FAIL (`buildAdPrompt` not exported).

- [ ] **Step 3: Implement — append to `src/lib/promptBuilder.ts`**

Add this import at the top (alongside the existing type imports):

```ts
import type { AdSizeDef } from './adFormats';
```

Append at the end of the file:

```ts
export type BuildAdPromptInput = {
  brief: BriefForPresets;
  brand?: BrandProfile | null;
  size: AdSizeDef;
  referenceCount?: number;
  userOverride?: string;
  adCopy?: AdCopy | null;
};

function adCopyLayer(adCopy: AdCopy): string {
  const parts: string[] = [
    'this is a finished advertising creative — composition and layout must support the overlaid sales message, kept within the central safe area so nothing critical is lost when cropped',
    `render the headline "${adCopy.headline}" centered, large bold sans-serif, high contrast over a subtle shape for legibility, no typos`,
    `set the subhead "${adCopy.subhead}" near the headline in a smaller medium-weight sans-serif, one line if possible`,
  ];
  if (adCopy.cta) {
    parts.push(
      `render a solid rounded-pill button containing the text "${adCopy.cta}" in bold sans-serif, brand-accent fill, inside the central safe area`,
    );
  }
  parts.push(
    'all rendered text must be perfectly spelled, sharp, and evenly kerned; absolutely no extra, garbled, or duplicate words',
  );
  return parts.join('. ');
}

/**
 * Build the prompt for one Civitai-ad creative. The image is generated at the
 * size's nearest supported aspect ratio, then center-cropped to the exact pixel
 * size on export — so the prompt instructs a crop-safe, center-weighted layout.
 */
export function buildAdPrompt(input: BuildAdPromptInput): EnhancedPrompt {
  const { brief, brand, size, referenceCount = 0, userOverride, adCopy } = input;

  const baseDescription = (brief.description?.trim() || brief.prompt?.trim() || '').replace(
    /\s+/g,
    ' ',
  );
  const base = assemble([
    baseDescription,
    brief.goal ? `goal: ${brief.goal}` : undefined,
    brief.offer ? `offer: ${brief.offer}` : undefined,
    brief.audience ? `audience: ${brief.audience}` : undefined,
    brief.aesthetics ? `aesthetic: ${brief.aesthetics}` : undefined,
  ]);

  const hasCopy = !!adCopy && !!adCopy.headline && !!adCopy.subhead;
  const intentStr = `digital advertising creative for a ${size.width}×${size.height} px ${size.formats.join('/')} ad placement, designed to be center-cropped to exactly ${size.width}×${size.height}px — keep the product hero and any text within the central safe area`;
  const brandStr = brandLayer(brand ?? null);
  const refStr = referenceLayer(referenceCount);
  const styleStr = hasCopy
    ? `${size.styleNotes}. on-brand, product-forward, polished ad creative, commercial-grade, high quality`
    : `${size.styleNotes}. on-brand, product-forward, no text overlay, high quality`;
  const copyStr = hasCopy ? adCopyLayer(adCopy as AdCopy) : '';

  const finalPrompt = assemble([intentStr, base, brandStr, refStr, styleStr, copyStr]);

  return {
    base,
    brandLayer: brandStr,
    styleLayer: styleStr,
    finalPrompt,
    negativePrompt: hasCopy ? CAMPAIGN_TEXT_NEGATIVE : DEFAULT_NEGATIVE,
    aspectRatio: size.aspectRatio,
    userOverride: userOverride && userOverride.trim() ? userOverride.trim() : undefined,
  };
}
```

> `brandLayer`, `referenceLayer`, `assemble`, `DEFAULT_NEGATIVE`, `CAMPAIGN_TEXT_NEGATIVE`, `EnhancedPrompt`, `BriefForPresets`, `BrandProfile`, `AdCopy` already exist in this file's scope/imports — reuse them, don't redefine.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/promptBuilder.adprompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/lib/promptBuilder.ts src/lib/promptBuilder.adprompt.test.ts
git commit -m "feat(ads): crop-safe ad prompt builder"
```

---

## Task 5: Database schema + migration

Add two tables and one enum value. **Read `src/lib/db/schema.ts` first** and mirror the exact local style: the `campaigns`/`campaignTiles` table definitions, the `tileStatus` pgEnum, and the `generationSource` pgEnum (add `'ad_campaign'` to its value list).

**Files:**
- Modify: `src/lib/db/schema.ts`
- Generate: `drizzle/` migration (via `pnpm db:generate`)

- [ ] **Step 1: Add `'ad_campaign'` to the generation-source enum**

Find the `generationSource` pgEnum (values `'campaign' | 'photoshoot' | 'adhoc' | 'upscale' | 'animate'`) and add `'ad_campaign'`:

```ts
// becomes: ['campaign', 'photoshoot', 'ad_campaign', 'adhoc', 'upscale', 'animate']
```

- [ ] **Step 2: Add the two tables (mirror `campaigns`/`campaignTiles`)**

Append to `schema.ts`, matching local column-helper style (`uuid('id').primaryKey().defaultRandom()`, `text(...)`, `integer(...).notNull().default(0)`, `timestamp(...).notNull().defaultNow()`, `jsonb(...)`, `.array()` for text arrays, `index(...)/uniqueIndex(...)`). Reuse the existing `tileStatus` enum and FK targets (`users.id` cascade, `brandProfiles.id`/`products.id`/`assets.id` set null).

```ts
export const adCampaigns = pgTable(
  'ad_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => brandProfiles.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    brief: jsonb('brief').notNull(),
    sizeIds: text('size_ids').array().notNull().default([]),
    referenceAssetIds: text('reference_asset_ids').array().notNull().default([]),
    enhancedPrompts: jsonb('enhanced_prompts'),
    adCopy: jsonb('ad_copy'),
    audience: text('audience'),
    aesthetics: text('aesthetics'),
    estimatedBuzz: integer('estimated_buzz').notNull().default(0),
    actualBuzz: integer('actual_buzz').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('ad_campaigns_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const adCampaignTiles = pgTable(
  'ad_campaign_tiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adCampaignId: uuid('ad_campaign_id')
      .notNull()
      .references(() => adCampaigns.id, { onDelete: 'cascade' }),
    sizeId: text('size_id').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    aspectRatio: text('aspect_ratio').notNull(),
    workflowId: text('workflow_id').notNull(),
    prompt: text('prompt').notNull(),
    seed: text('seed'),
    quantity: integer('quantity').notNull().default(1),
    status: tileStatus('status').notNull().default('queued'),
    estimatedBuzz: integer('estimated_buzz').notNull().default(0),
    actualBuzz: integer('actual_buzz').notNull().default(0),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    adCopy: jsonb('ad_copy'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index('ad_campaign_tiles_campaign_idx').on(t.adCampaignId),
    workflowUidx: uniqueIndex('ad_campaign_tiles_workflow_uidx').on(t.workflowId),
  }),
);
```

> If the local file uses the array form `(t) => [ ... ]` for indexes instead of the object form, match that. Reuse existing imports; add any missing (`index`, `uniqueIndex`) to the drizzle-orm/pg-core import.

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new SQL file appears under `drizzle/` creating `ad_campaigns` + `ad_campaign_tiles` and `ALTER TYPE ... ADD VALUE 'ad_campaign'`.

- [ ] **Step 4: Review the SQL**

Run: `git status --short drizzle/ && cat drizzle/<new-file>.sql`
Expected: two `CREATE TABLE` statements, the indexes, the enum `ADD VALUE`, FKs as specified. No `DROP` of existing objects.

- [ ] **Step 5: Apply migration to dev + test DBs**

Run: `pnpm db:migrate && pnpm test:db:setup`
Expected: both complete without error.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(ads): ad_campaigns + ad_campaign_tiles schema and migration"
```

---

## Task 6: Make asset sync + failure ad-aware (`assets.ts`)

Extend the two helpers that resolve a tile by `workflowId` so they also check `ad_campaign_tiles`. Additions only.

**Files:**
- Modify: `src/lib/assets.ts`

- [ ] **Step 1: Import the new table**

In the existing drizzle-schema import block (which already imports `campaignTiles`, `photoshootTiles`), add `adCampaignTiles`.

- [ ] **Step 2: Extend `syncAssetsFromSnapshot` tile resolution**

After the `photoshootTile` lookup, add a third fallback and include it in `sourceTileId`:

```ts
const [adTile] =
  !campaignTile && !photoshootTile
    ? await db
        .select()
        .from(adCampaignTiles)
        .where(eq(adCampaignTiles.workflowId, workflowId))
        .limit(1)
    : [];

const sourceTileId = campaignTile?.id ?? photoshootTile?.id ?? adTile?.id ?? null;
```

In the `if (i === 0 && sourceTileId)` block, add an `else if (adTile)` branch mirroring the photoshoot branch:

```ts
} else if (adTile) {
  await db
    .update(adCampaignTiles)
    .set({ assetId: row.id, status: 'done', updatedAt: new Date() })
    .where(eq(adCampaignTiles.id, sourceTileId));
}
```

- [ ] **Step 3: Extend `markTileFailed`**

After the `photoshootTile` branch, before the function ends, add:

```ts
const [adTile] = await db
  .select({ id: adCampaignTiles.id })
  .from(adCampaignTiles)
  .where(eq(adCampaignTiles.workflowId, workflowId))
  .limit(1);
if (adTile) {
  await db
    .update(adCampaignTiles)
    .set({ status: 'failed', error: errorMsg, updatedAt: new Date() })
    .where(eq(adCampaignTiles.id, adTile.id));
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/lib/assets.ts
git commit -m "feat(ads): link ad-campaign tiles in asset sync and failure paths"
```

---

## Task 7: Ad-campaign data module (`adCampaigns.ts`)

Mirror `src/lib/campaigns.ts` but **without** tile versioning. **Read `src/lib/campaigns.ts` first** for the exact drizzle query/transaction style and the `assetUrl` resolution helper it uses (resolve each tile's `assetId` → `assets.publicUrl`).

**Files:**
- Create: `src/lib/adCampaigns.ts`

- [ ] **Step 1: Implement the module**

Public API (match these names/signatures exactly — later tasks depend on them):

```ts
import 'server-only';
// drizzle imports: db, adCampaigns, adCampaignTiles, assets, eq, and, desc, inArray
import type { AdCopy } from './adCopy';
import type { BriefForPresets } from './presets';
import type { AspectRatio } from './promptBuilder';

export type AdTileStatus = 'queued' | 'cooking' | 'done' | 'failed';

export type AdCampaignTile = {
  id: string;
  sizeId: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  workflowId: string;
  status: AdTileStatus;
  prompt: string;
  quantity: number;
  adCopy: AdCopy | null;
  assetUrl: string | null;
};

export type AdCampaign = {
  id: string;
  userId: string;
  title: string;
  brief: BriefForPresets;
  sizeIds: string[];
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  adCopy: AdCopy | null;
  tiles: AdCampaignTile[];
  thumbUrl: string | null;
  estimatedBuzz: number;
  audience: string | null;
  aesthetics: string | null;
  createdAt: number;
};

export type CreateAdCampaignTileInput = {
  sizeId: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  workflowId: string;
  prompt: string;
  adCopy: AdCopy | null;
};

export type CreateAdCampaignInput = {
  userId: string;
  title: string;
  brief: BriefForPresets;
  sizeIds: string[];
  referenceAssetIds: string[];
  enhancedPrompts: Record<string, unknown> | null;
  adCopy: AdCopy | null;
  audience: string | null;
  aesthetics: string | null;
  estimatedBuzz: number;
  tiles: CreateAdCampaignTileInput[];
};

export async function createAdCampaign(input: CreateAdCampaignInput): Promise<AdCampaign>;
export async function getAdCampaign(userId: string, id: string): Promise<AdCampaign | null>;
export async function listAdCampaigns(userId: string): Promise<AdCampaign[]>;
export async function deleteAdCampaign(userId: string, id: string): Promise<void>;
export async function updateAdCampaign(
  userId: string,
  id: string,
  patch: { title?: string },
): Promise<void>;
export async function swapAdTileWorkflow(
  userId: string,
  campaignId: string,
  tileId: string,
  newWorkflowId: string,
  patch?: { prompt?: string; adCopy?: AdCopy | null },
): Promise<AdCampaignTile>;

/** Done tiles with a resolved public URL — used by the export route. */
export async function listAdCampaignAssets(
  userId: string,
  campaignId: string,
): Promise<Array<{ tileId: string; sizeId: string; width: number; height: number; publicUrl: string; contentType: string | null }>>;
```

Implementation rules (mirror `campaigns.ts`):
- `createAdCampaign`: single transaction — insert the `adCampaigns` row, then insert all `adCampaignTiles` rows (status `'cooking'`, since they're already submitted), return the assembled `AdCampaign` (tiles `assetUrl: null` at creation). NO `tileVersions`.
- `getAdCampaign`/`listAdCampaigns`: scope every query by `userId`; resolve each tile's `assetUrl` by joining/looking up `assets.publicUrl` via `tile.assetId`; `thumbUrl` = first done tile's `assetUrl`; `createdAt` as epoch ms (`row.createdAt.getTime()`), matching how `campaigns.ts` returns it.
- `swapAdTileWorkflow`: scoped ownership check (join tile→campaign→userId), update `workflowId`, set `status:'cooking'`, optional `prompt`/`adCopy`, `assetId:null`, `error:null`, `updatedAt:new Date()`; return the updated tile shape.
- `listAdCampaignAssets`: ownership-checked; return done tiles whose `assetId` resolves to an asset with a `publicUrl`, including `tile.width/height/sizeId` and `assets.contentType`.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/lib/adCampaigns.ts
git commit -m "feat(ads): ad-campaign persistence module"
```

---

## Task 8: Cook route (`POST /api/ads/cook`)

Mirror `src/app/api/campaigns/cook/route.ts`, swapping presets→ad sizes and dropping the LLM ad-copy generation (ad copy is an optional campaign-level field).

**Files:**
- Create: `src/app/api/ads/cook/route.ts`

- [ ] **Step 1: Implement**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AdCopy } from '@/lib/adCopy';
import { AD_SIZES, isAdSizeId } from '@/lib/adFormats';
import { createAdCampaign } from '@/lib/adCampaigns';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { buildAdPrompt, type EnhancedPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

const adCopySchema = z.object({
  headline: z.string().min(1).max(120),
  subhead: z.string().min(1).max(240),
  cta: z.string().max(48).optional(),
});

const cookSchema = briefSchema.extend({
  sizeIds: z.array(z.string()).min(1).max(6),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  adCopy: adCopySchema.nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = cookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_brief', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { sizeIds, referenceAssetIds, adCopy, ...brief } = parsed.data;

  const validSizeIds = [...new Set(sizeIds)].filter(isAdSizeId);
  if (validSizeIds.length === 0) {
    return NextResponse.json({ error: 'no_valid_sizes' }, { status: 400 });
  }

  const userKey = await getUserKey(session);
  const brand = await getDefaultBrand(userKey);

  let refUrls: string[];
  try {
    refUrls = referenceAssetIds.length > 0 ? await getPublicUrls(userKey, referenceAssetIds) : [];
  } catch (err) {
    if (err instanceof MissingReferenceError) {
      return NextResponse.json(
        { error: 'invalid_reference_assets', missing: err.count, kind: err.kind },
        { status: 400 },
      );
    }
    throw err;
  }

  const adCopyVal: AdCopy | null = adCopy ?? null;

  const perSize = validSizeIds.map((sizeId) => {
    const size = AD_SIZES[sizeId]!;
    const enhanced = buildAdPrompt({
      brief,
      brand,
      size,
      referenceCount: refUrls.length,
      adCopy: adCopyVal,
    });
    const finalPrompt = resolveFinalPrompt(enhanced);
    const input: VitrineImageGenInput = {
      prompt: finalPrompt,
      aspectRatio: enhanced.aspectRatio,
      numImages: 1,
      resolution: '2K',
      ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
      ...(refUrls.length > 0 ? { images: refUrls } : {}),
    };
    return { size, enhanced, finalPrompt, input };
  });

  const submitMeta = perSize.map((p) => p.size.id);
  const settled = await Promise.allSettled(
    perSize.map(async (p) => {
      const submit = await submitImageGen(session, p.input);
      return {
        size: p.size,
        workflowId: submit.id,
        prompt: p.finalPrompt,
        estimatedCost: submit.cost?.total ?? 0,
        input: p.input,
        enhanced: p.enhanced,
      };
    }),
  );

  const successes: Array<{
    size: (typeof perSize)[number]['size'];
    workflowId: string;
    prompt: string;
    estimatedCost: number;
    input: VitrineImageGenInput;
    enhanced: EnhancedPrompt;
  }> = [];
  const failures: Array<{ sizeId: string; error: string; status?: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    const sizeId = submitMeta[i]!;
    if (r.status === 'fulfilled') successes.push(r.value);
    else {
      const reason: unknown = r.reason;
      failures.push({
        sizeId,
        error: reason instanceof OrchestratorError ? 'orchestrator_error' : 'submit_failed',
        status: reason instanceof OrchestratorError ? reason.status : undefined,
      });
    }
  }

  if (successes.length === 0) {
    return NextResponse.json(
      { error: 'all_submits_failed', failures },
      { status: failures[0]?.status && failures[0].status >= 400 ? failures[0].status : 502 },
    );
  }

  const estimatedBuzz = successes.reduce((sum, s) => sum + s.estimatedCost, 0);
  const enhancedRecord: Record<string, EnhancedPrompt> = {};
  for (const s of successes) enhancedRecord[s.size.id] = s.enhanced;

  const campaign = await createAdCampaign({
    userId: userKey,
    title: brief.title,
    brief,
    sizeIds: successes.map((s) => s.size.id),
    referenceAssetIds,
    enhancedPrompts: enhancedRecord as Record<string, unknown>,
    adCopy: adCopyVal,
    audience: brief.audience?.trim() || null,
    aesthetics: brief.aesthetics?.trim() || null,
    estimatedBuzz,
    tiles: successes.map((s) => ({
      sizeId: s.size.id,
      width: s.size.width,
      height: s.size.height,
      aspectRatio: s.size.aspectRatio,
      workflowId: s.workflowId,
      prompt: s.prompt,
      adCopy: adCopyVal,
    })),
  });

  await Promise.all(
    successes.map(async (s) => {
      const tile = campaign.tiles.find((t) => t.workflowId === s.workflowId);
      await Promise.all([
        recordGeneration({
          workflowId: s.workflowId,
          userId: userKey,
          source: 'ad_campaign',
          sourceId: campaign.id,
          tileId: tile?.id,
          prompt: s.prompt,
          input: s.input as unknown as Record<string, unknown>,
          estimatedBuzz: s.estimatedCost,
        }),
        recordBuzzEvent({
          userId: userKey,
          workflowId: s.workflowId,
          kind: 'estimate',
          estimated: s.estimatedCost,
          note: 'cook',
        }),
      ]);
    }),
  );

  return NextResponse.json({
    adCampaignId: campaign.id,
    ...(failures.length > 0 ? { partial: failures } : {}),
  });
}
```

> If `recordGeneration`'s `input` param name differs from `input`, match the real signature in `src/lib/generations.ts`. If `briefSchema` lives elsewhere, follow the import used by `campaigns/cook/route.ts`.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/app/api/ads/cook/route.ts
git commit -m "feat(ads): cook route submits one creative per ad size"
```

---

## Task 9: Estimate route (`POST /api/ads/estimate`)

Surfaces total Buzz cost before cook. **Read `src/lib/civitai.ts` for `estimateImageGen`'s signature/return** (returns a snapshot with `cost.total`).

**Files:**
- Create: `src/app/api/ads/estimate/route.ts`

- [ ] **Step 1: Implement**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AD_SIZES, isAdSizeId } from '@/lib/adFormats';
import { getDefaultBrand } from '@/lib/brand';
import { briefSchema } from '@/lib/briefSchema';
import { estimateImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { buildAdPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';

const estimateSchema = briefSchema.extend({
  sizeIds: z.array(z.string()).min(1).max(6),
  adCopy: z
    .object({
      headline: z.string().min(1).max(120),
      subhead: z.string().min(1).max(240),
      cta: z.string().max(48).optional(),
    })
    .nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const parsed = estimateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_brief' }, { status: 400 });
  }
  const { sizeIds, adCopy, ...brief } = parsed.data;
  const validSizeIds = [...new Set(sizeIds)].filter(isAdSizeId);
  if (validSizeIds.length === 0) return NextResponse.json({ error: 'no_valid_sizes' }, { status: 400 });

  // Brand is read for parity with cook; estimate cost does not depend on brand text.
  const brand = await getDefaultBrand('estimate-noop').catch(() => null);

  const perSize: Record<string, number> = {};
  let total = 0;
  await Promise.all(
    validSizeIds.map(async (sizeId) => {
      const size = AD_SIZES[sizeId]!;
      const enhanced = buildAdPrompt({ brief, brand, size, adCopy: adCopy ?? null });
      const input: VitrineImageGenInput = {
        prompt: resolveFinalPrompt(enhanced),
        aspectRatio: enhanced.aspectRatio,
        numImages: 1,
        resolution: '2K',
      };
      const snap = await estimateImageGen(session, input);
      const cost = snap.cost?.total ?? 0;
      perSize[sizeId] = cost;
      total += cost;
    }),
  );

  return NextResponse.json({ total, perSize });
}
```

> Replace the `getDefaultBrand('estimate-noop')` line with the real user-scoped brand load used by `campaigns/estimate/route.ts` if it differs — i.e. `const userKey = await getUserKey(session); const brand = await getDefaultBrand(userKey);`. Prefer the user-scoped version; the noop is only a fallback if the campaigns estimate route doesn't load a brand.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/app/api/ads/estimate/route.ts
git commit -m "feat(ads): estimate route for pre-cook cost preview"
```

---

## Task 10: Regenerate route (`POST /api/ads/[id]/tiles/[tileId]/regenerate`)

Mirror `src/app/api/campaigns/[id]/tiles/[tileId]/regenerate/route.ts`.

**Files:**
- Create: `src/app/api/ads/[id]/tiles/[tileId]/regenerate/route.ts`

- [ ] **Step 1: Implement**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AD_SIZES } from '@/lib/adFormats';
import { getAdCampaign, swapAdTileWorkflow } from '@/lib/adCampaigns';
import { getPublicUrls, MissingReferenceError } from '@/lib/assets';
import { getDefaultBrand } from '@/lib/brand';
import { recordBuzzEvent } from '@/lib/buzz';
import { OrchestratorError, submitImageGen, type VitrineImageGenInput } from '@/lib/civitai';
import { recordGeneration } from '@/lib/generations';
import { buildAdPrompt, resolveFinalPrompt } from '@/lib/promptBuilder';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

const bodySchema = z.object({
  promptHint: z.string().max(2000).optional(),
  prompt: z.string().max(4000).optional(),
  adCopy: z
    .object({
      headline: z.string().min(1).max(120),
      subhead: z.string().min(1).max(240),
      cta: z.string().max(48).optional(),
    })
    .nullish(),
});

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });

  const size = AD_SIZES[tile.sizeId];
  if (!size) return NextResponse.json({ error: 'unknown_size' }, { status: 400 });

  const brand = await getDefaultBrand(userKey);

  let refUrls: string[] = [];
  try {
    refUrls =
      campaign.referenceAssetIds.length > 0
        ? await getPublicUrls(userKey, campaign.referenceAssetIds)
        : [];
  } catch (err) {
    if (!(err instanceof MissingReferenceError)) throw err;
  }

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  const { promptHint, prompt: promptOverride, adCopy } = body.success ? body.data : {};

  const enhanced = buildAdPrompt({
    brief: campaign.brief,
    brand,
    size,
    referenceCount: refUrls.length,
    adCopy: adCopy ?? campaign.adCopy ?? null,
    ...(promptOverride ? { userOverride: promptOverride } : {}),
  });
  const basePrompt = resolveFinalPrompt(enhanced);
  const finalPrompt = promptHint ? `${basePrompt}. ${promptHint}` : basePrompt;

  const input: VitrineImageGenInput = {
    prompt: finalPrompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: 1,
    resolution: '2K',
    ...(enhanced.negativePrompt ? { negativePrompt: enhanced.negativePrompt } : {}),
    ...(refUrls.length > 0 ? { images: refUrls } : {}),
  };

  let workflowId: string;
  let estimatedCost = 0;
  try {
    const submit = await submitImageGen(session, input);
    workflowId = submit.id;
    estimatedCost = submit.cost?.total ?? 0;
  } catch (err) {
    if (err instanceof OrchestratorError) {
      return NextResponse.json({ error: 'orchestrator_error' }, { status: err.status });
    }
    throw err;
  }

  const updated = await swapAdTileWorkflow(userKey, id, tileId, workflowId, {
    prompt: finalPrompt,
    adCopy: adCopy ?? campaign.adCopy ?? null,
  });

  await Promise.all([
    recordGeneration({
      workflowId,
      userId: userKey,
      source: 'ad_campaign',
      sourceId: id,
      tileId,
      prompt: finalPrompt,
      input: input as unknown as Record<string, unknown>,
      estimatedBuzz: estimatedCost,
    }),
    recordBuzzEvent({
      userId: userKey,
      workflowId,
      kind: 'estimate',
      estimated: estimatedCost,
      note: 'regenerate',
    }),
  ]);

  return NextResponse.json({ tile: updated, workflowId });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add 'src/app/api/ads/[id]/tiles/[tileId]/regenerate/route.ts'
git commit -m "feat(ads): regenerate a single ad creative"
```

---

## Task 11: Export + single-download routes (exact pixels)

Mirror `src/app/api/campaigns/[id]/export/route.ts` for the ZIP; add a single-tile crop download. Both crop server-side with `cropToExactPng`.

**Files:**
- Create: `src/app/api/ads/[id]/export/route.ts`
- Create: `src/app/api/ads/[id]/tiles/[tileId]/download/route.ts`

- [ ] **Step 1: Export route**

```ts
// src/app/api/ads/[id]/export/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { cropToExactPng } from '@/lib/adExport';
import { getAdCampaign, listAdCampaignAssets } from '@/lib/adCampaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { buildZipStored, type ZipEntry } from '@/lib/zip';

type Params = Promise<{ id: string }>;

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'ad-campaign';
}

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const entries = await listAdCampaignAssets(userKey, id);
  if (entries.length === 0) {
    return NextResponse.json({ error: 'no_assets', detail: 'no completed creatives' }, { status: 409 });
  }

  const zipEntries: ZipEntry[] = [];
  const used = new Set<string>();
  for (const entry of entries) {
    let res: Response;
    try {
      res = await fetch(entry.publicUrl);
    } catch (err) {
      return NextResponse.json(
        { error: 'fetch_failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'fetch_failed', detail: `${res.status}` }, { status: 502 });
    }
    const cropped = await cropToExactPng(await res.arrayBuffer(), entry.width, entry.height);
    let name = `${safeName(entry.sizeId)}-${entry.width}x${entry.height}.png`;
    let dup = 1;
    while (used.has(name)) name = `${safeName(entry.sizeId)}-${entry.width}x${entry.height}-${++dup}.png`;
    used.add(name);
    zipEntries.push({ name, data: cropped });
  }

  const zip = buildZipStored(zipEntries);
  const filename = `${safeName(campaign.title)}-ads.zip`;
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zip.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Single-download route**

```ts
// src/app/api/ads/[id]/tiles/[tileId]/download/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { cropToExactPng } from '@/lib/adExport';
import { getAdCampaign } from '@/lib/adCampaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ id: string; tileId: string }>;

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'ad';
}

export async function GET(_: NextRequest, ctx: { params: Params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id, tileId } = await ctx.params;

  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const tile = campaign.tiles.find((t) => t.id === tileId);
  if (!tile) return NextResponse.json({ error: 'tile_not_found' }, { status: 404 });
  if (tile.status !== 'done' || !tile.assetUrl) {
    return NextResponse.json({ error: 'not_ready' }, { status: 409 });
  }

  let res: Response;
  try {
    res = await fetch(tile.assetUrl);
  } catch (err) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  if (!res.ok) return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });

  const cropped = await cropToExactPng(await res.arrayBuffer(), tile.width, tile.height);
  const filename = `${safeName(tile.sizeId)}-${tile.width}x${tile.height}.png`;
  return new Response(new Uint8Array(cropped), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(cropped.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add 'src/app/api/ads/[id]/export/route.ts' 'src/app/api/ads/[id]/tiles/[tileId]/download/route.ts'
git commit -m "feat(ads): exact-pixel zip export and single-creative download"
```

---

## Task 12: Navigation entry

**Files:**
- Modify: `src/components/shell/nav.ts`

- [ ] **Step 1: Add the nav item**

Import a lucide icon (use `Frame` — verify it's a valid lucide-react export; if not, use `RectangleHorizontal`). Add to the `NAV` array right after the `photoshoot` item:

```ts
{ id: 'ads', label: 'ads', href: '/ads', icon: Frame, shortcut: '⌘4' },
```

Match the exact `NavItem` shape already used by sibling entries (some use `indent`, `icon`, `shortcut` — only set the fields the others set).

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/components/shell/nav.ts
git commit -m "feat(ads): add ads nav entry"
```

---

## Task 13: UI components (`components/ads/*`)

**Read the sibling campaign components first** and mirror their structure, styling, and shared `@/components/ui` primitives. Build these client components against the contracts below. Keep each file focused.

**Files:**
- Create: `src/components/ads/AdSizePicker.tsx`
- Create: `src/components/ads/AdCampaignWizard.tsx`
- Create: `src/components/ads/AdCampaignsList.tsx`
- Create: `src/components/ads/AdCreativeCard.tsx`
- Create: `src/components/ads/AdCampaignDetail.tsx`
- Create: `src/components/ads/ExportAdCampaignButton.tsx`

- [ ] **Step 1: `AdSizePicker.tsx`** — controlled multi-select of ad sizes.

Props: `{ value: string[]; onChange: (ids: string[]) => void }`. Render `AD_SIZE_LIST` (from `@/lib/adFormats`) grouped by their `formats`; each option shows `label` (e.g. "Leaderboard · 728×90") and a small box whose CSS aspect-ratio = `width / height` to preview the shape. Toggling an id updates `value`. Mirror `PresetGrid.tsx`’s selection styling.

- [ ] **Step 2: `AdCampaignWizard.tsx`** — the new-ad-campaign flow.

Props: `{ brand, assets, products, buzz }` (same shapes the campaign wizard receives from its `new/page.tsx` — read `campaigns/new/page.tsx` + `CampaignWizard.tsx` for the exact prop types and reuse them). Behaviour:
1. Brief fields (title, description, goal, offer, audience?, aesthetics?) — reuse the campaign brief input components/patterns.
2. `AdSizePicker`, defaulting `value` to `recommendedAdSizeIds()`.
3. Optional "add headline / CTA" toggle revealing `headline`, `subhead`, `cta` inputs → builds the campaign-level `adCopy` (or `null`).
4. Cost preview: on entering the review step, POST the brief + `sizeIds` (+ `adCopy`) to `/api/ads/estimate`; show `total` Buzz beside the user's `buzz` balance. If estimate fails, show "estimate unavailable" and still allow submit.
5. Submit: POST the same payload to `/api/ads/cook`; on `{ adCampaignId }` → `router.push('/ads/' + adCampaignId)`. Surface `partial` failures as a non-blocking notice.

- [ ] **Step 3: `AdCreativeCard.tsx`** — one creative tile with live polling + actions.

Props: `{ campaignId: string; tile: AdCampaignTile }` (type from `@/lib/adCampaigns`). Behaviour:
- If `tile.status` is `queued`/`cooking` and a `workflowId` exists, poll `GET /api/workflow/${tile.workflowId}?wait=15000` in a loop until the snapshot `done`, then refresh the route (`router.refresh()`) so the server re-renders with the linked asset. Reuse the polling pattern in `src/components/generations/PollingCard.tsx`.
- Render the image inside a fixed box whose CSS `aspect-ratio` = `tile.width / tile.height`, `object-fit: cover`, so the preview equals the cropped deliverable. Label it `tile.width×tile.height`.
- "download" link → `/api/ads/${campaignId}/tiles/${tile.id}/download` (anchor with `download`).
- "regenerate" → a small dialog with an optional prompt-hint textarea; POST `/api/ads/${campaignId}/tiles/${tile.id}/regenerate` `{ promptHint }`; on success update local state and resume polling the new `workflowId`.
- Failed state: show `error` + a regenerate affordance.

- [ ] **Step 4: `AdCampaignDetail.tsx`** — header + grid.

Props: `{ campaign: AdCampaign }`. Render an editable title (mirror `CampaignHeaderEditable.tsx`, PATCHing — if no ad PATCH route exists, omit inline edit for MVP and just show the title), `ExportAdCampaignButton`, and a responsive grid of `AdCreativeCard` for each `campaign.tiles`.

- [ ] **Step 5: `AdCampaignsList.tsx`** — past campaigns grid.

Props: `{ campaigns: AdCampaign[] }`. Mirror `CampaignsList.tsx`: each card links to `/ads/${c.id}`, shows `title`, size count (`c.sizeIds.length`), a cooking badge if any tile is not done, and `c.thumbUrl`. Include an empty state with a link to `/ads/new`.

- [ ] **Step 6: `ExportAdCampaignButton.tsx`** — copy `ExportCampaignButton.tsx` exactly, changing the fetch URL to `/api/ads/${campaignId}/export` and the default filename to `ad-campaign.zip`.

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/components/ads/
git commit -m "feat(ads): ad-campaign wizard, size picker, detail grid, export"
```

---

## Task 14: Pages (`app/(app)/ads/*`)

Mirror the campaign pages. All under `(app)` ⇒ auth + onboarding gated automatically.

**Files:**
- Create: `src/app/(app)/ads/page.tsx`
- Create: `src/app/(app)/ads/new/page.tsx`
- Create: `src/app/(app)/ads/[id]/page.tsx`

- [ ] **Step 1: List page** (RSC) — mirror `campaigns/page.tsx`:

```tsx
import { listAdCampaigns } from '@/lib/adCampaigns';
import { AdCampaignsList } from '@/components/ads/AdCampaignsList';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
// + redirect to '/' if no session, matching the sibling

export default async function AdsPage() {
  const session = await getSession();
  if (!session) { /* redirect('/') as the sibling does */ }
  const userKey = await getUserKey(session!);
  const campaigns = await listAdCampaigns(userKey);
  return <AdCampaignsList campaigns={campaigns} />;
}
```

- [ ] **Step 2: New page** (RSC) — mirror `campaigns/new/page.tsx` exactly for data loading (brand, assets, products, buzz account), then render `<AdCampaignWizard {...sameProps} />`.

- [ ] **Step 3: Detail page** (RSC) — mirror `campaigns/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getAdCampaign } from '@/lib/adCampaigns';
import { AdCampaignDetail } from '@/components/ads/AdCampaignDetail';
// + session/userKey as siblings

type Params = Promise<{ id: string }>;
export default async function AdCampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  // session + userKey per sibling
  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) notFound();
  return <AdCampaignDetail campaign={campaign} />;
}
```

- [ ] **Step 4: Typecheck + build + commit**

Run: `pnpm typecheck && pnpm build`
Expected: typecheck clean; build succeeds (the `/ads`, `/ads/new`, `/ads/[id]` routes appear in the output).

```bash
git add 'src/app/(app)/ads/'
git commit -m "feat(ads): ads list, new, and detail pages"
```

---

## Task 15: End-to-end test (`70-ads.spec.ts`)

Mirror `tests/e2e/50-campaigns.spec.ts`. Cook an ad campaign against the MSW-mocked orchestrator and assert the creatives reach `done`.

**Files:**
- Create: `tests/e2e/70-ads.spec.ts`
- Check: `src/mocks/handlers.ts` (the orchestrator submit/estimate/workflow handlers already used by campaigns must cover the ad cook — they should, since ads reuse `submitImageGen`/`estimateImageGen`/`/api/workflow/[id]`). If a handler is preset-specific, generalise it; do NOT special-case ad sizes.

- [ ] **Step 1: Read the sibling spec** `tests/e2e/50-campaigns.spec.ts` to copy its login/onboarding setup, cook trigger, and polling-assertion helpers.

- [ ] **Step 2: Write the ad spec** mirroring it:
  - Navigate to `/ads/new`.
  - Fill the brief, ensure at least one ad size is selected (defaults from `recommendedAdSizeIds()`).
  - Submit; assert redirect to `/ads/<uuid>`.
  - Assert each creative card transitions from a cooking state to a rendered image (`done`) within the polling window.
  - Assert an export/download affordance is present.

- [ ] **Step 3: Run it**

Run: `pnpm test:e2e tests/e2e/70-ads.spec.ts`
Expected: PASS. (If it can't run in this environment per the README prereqs, ensure it at least compiles and is included; note any environment gap.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/70-ads.spec.ts src/mocks/handlers.ts
git commit -m "test(ads): e2e cook flow against mocked orchestrator"
```

---

## Task 16: Docs + full verification

**Files:**
- Modify: `AGENTS.md` (extend the file-layout + extending tables to mention ads, mirroring how campaigns/photoshoots are documented)

- [ ] **Step 1: Update `AGENTS.md`**

Add `ads/` alongside `campaigns/`/`photoshoot/` in the `src/app/(app)/` tree and the components list; add an "Ads campaign" row to the demo flow / extending table noting: sizes come from `src/lib/adFormats.ts`; exact pixels are produced by server-side `sharp` crop in `src/lib/adExport.ts`; generation source enum value is `ad_campaign`.

- [ ] **Step 2: Full verification sweep**

Run each, expecting success:
- `pnpm typecheck`
- `pnpm vitest run` (unit) — all green, including the three new ad suites
- `pnpm build`
- `pnpm test:e2e` (full suite; ensure no regression in campaigns/photoshoot specs)

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(ads): document the ads campaign feature in AGENTS.md"
```

---

## Self-review notes (carried from plan authoring)
- **Spec coverage:** every spec section maps to a task — catalog→T2, crop→T3, prompt→T4, schema/enum→T5, asset/gen plumbing→T5/T6, lib→T7, cook/estimate/regenerate/export/download routes→T8–T11, nav→T12, components→T13, pages→T14, tests→T2/T3/T4/T15, AGENTS.md→T16.
- **Type consistency:** `AdCampaign`/`AdCampaignTile`/`createAdCampaign`/`swapAdTileWorkflow`/`listAdCampaignAssets` defined in T7 are the exact names consumed by T8–T11/T13/T14. `cropToExactPng` (T3) consumed by T11. `buildAdPrompt` (T4) consumed by T8–T10. `AD_SIZES`/`isAdSizeId`/`recommendedAdSizeIds`/`AD_SIZE_LIST` (T2) consumed throughout.
- **Known follow-ups (out of MVP scope):** deterministic text/logo overlay compositor; per-size LLM copy; ad-tile version history; editable detail title PATCH route if not trivially mirrored.
```
