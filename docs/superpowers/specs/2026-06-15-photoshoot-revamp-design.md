# Photoshoot Revamp — Design Spec

**Date:** 2026-06-15
**Source:** `feedback/2026-06-15-photoshoot.md`
**Scope:** Align the photoshoot flow (`/photoshoot`, `/photoshoot/new`, `/photoshoot/[id]`) with the campaign flow — reuse the campaign prompt-composer + LLM draft pattern, add inline editing, fix the per-style review, and rebuild the details page to the campaign row layout.

---

## Goals

Reshape the photoshoot feature so it mirrors campaigns where it makes sense, driven by the review feedback:

1. **Grid** (`/photoshoot`): fix step label, widen to ≤4 columns, fill cover collages from all shots/variants.
2. **New** (`/photoshoot/new`): add a campaign-style compose step (product + reference picker + prompt) feeding an LLM that improves the prompt and preselects styles; configure step shows prefilled read-only product/refs, a free-text name, an editable prompt, preselected styles, 16:9 ratio, and a live Buzz estimate.
3. **Review**: inline-editable prompts (no toggle), one card per selected style (not per style group), improved per-style prompts, and confirmed product+reference image delivery to the orchestrator.
4. **Details** (`/photoshoot/[id]`): rebuild to the campaign details layout — one row per style with a horizontal variant list — remove the `linkedin · 1:1` badge, relocate "use as product image" / "use in campaign" to per-variant actions, and drop the text between breadcrumb and title.

Non-goals: changing the photoshoot DB schema, switching photoshoots to the campaign per-variant-tile model, migrating existing photoshoots, or touching the campaign wizard internals beyond what shared reuse requires.

---

## Current state (as-built)

- **Data model** (`src/lib/photoshoots.ts`, `src/lib/db/schema.ts`): a photoshoot has N `photoshoot_tiles`. **One tile per selected template** (style); the tile's workflow is submitted with `numImages = brief.variantsPerTemplate`, so a single tile holds multiple variant images. `syncAssetsFromSnapshot` creates one `assets` row per output image (`sourceTileId = tile.id`) and links the **first** image to `tile.assetId`.
- **Templates** (`src/lib/photoshootTemplates.ts`): 7 templates across `studio` / `lifestyle` / `hero` groups; each has `styleNotes` prose. `PhotoshootRatio = '1:1' | '4:5' | '9:16'` (no 16:9). `PhotoshootBrief = { productName, productNotes, ratio, variantsPerTemplate, templateIds }`.
- **Wizard** (`src/components/photoshoot/PhotoshootWizard.tsx`): steps `brief → review → submit`. Brief step does template selection + product subject + reference picker + ratio + variants. Review step uses a per-template card with a `+ edit raw prompt` toggle. There is **no LLM draft step**; prompts are built deterministically by `buildPhotoshootPrompt`.
- **Prompt build** (`src/lib/promptBuilder.ts`): `buildPhotoshootPrompt` assembles `base (product) + brandLayer + referenceLayer + styleLayer`. `EnhancedPrompt.userOverride` wins via `resolveFinalPrompt`.
- **APIs**: `POST /api/photoshoot/preview` (estimate, free), `POST /api/photoshoot/cook` (submit), `POST /api/photoshoot/[id]/tiles/[tileId]/regenerate`. Cook resolves `referenceAssetIds` (which may be `asset:<id>` / `product:<id>`) via `getPublicUrls` → orchestrator `images[]`.
- **List** (`src/components/photoshoot/PhotoshootList.tsx`): eyebrow `// step 2 · shoot`; grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; cover = 2×2 collage from `shoot.thumbUrls` (first image per tile in creation order, capped at 4).
- **Details** (`src/components/photoshoot/PhotoshootResults.tsx`): renders `CreativeCard` per tile in a `sm:grid-cols-2 xl:grid-cols-4` grid; shows a `linkedin · 1:1` preset badge (via `ratioToPresetId`); a source-product line between breadcrumb and title; select-mode + bottom bulk action bar for "add to product" / "start campaign".

## Campaign reference (the patterns we mirror)

- **Compose step**: campaign `PromptStep` = prompt `<textarea>` + `AssetCatalogPicker` (`src/components/pickers/AssetCatalogPicker.tsx`, emits `product:<id>` / `asset:<id>`) → `POST /api/campaigns/draft`.
- **LLM draft**: `generateCampaignDraft` (`src/lib/adCopy.ts`) — OpenRouter via OpenAI SDK, model fallback chain, JSON mode with prose fallback, `fallbackDraft` when the key is missing or all models fail; returns `{ draft, meta: { llm: 'ok'|'fallback', model?, attempts?, reason? } }`.
- **Estimate**: `POST /api/campaigns/preview` + `useCampaignPreview` (debounced) → `{ enhancedPrompts, estimatePerPreset, totalBuzz }`, surfaced as a `BuzzPill`.
- **Details layout**: `CampaignCreativeGrid` → one `CampaignCreativeRow` per group. Row header = `label` + variant count; body = `flex gap-3 overflow-x-auto pb-1` of fixed-width thumbs; each thumb has an overflow `⋮` menu (Edit / Download / Regenerate).

---

## Design

### A. Grid page (`/photoshoot`)

1. **Step label** — `PhotoshootList.tsx`: `// step 2 · shoot` → `// step 1 · shoot`.
2. **Columns** — grid becomes `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (max 4).
3. **Cover collage fill** — change thumbnail selection in `listPhotoshoots` (`src/lib/photoshoots.ts`) to fill up to 4 slots by **round-robin across shots (tiles)**:
   - Gather **all** image URLs per tile (assets where `sourceTileId = tile.id`, ordered; fallback to snapshot images), not just the first.
   - Round-robin: take one image from each tile in turn, repeat until 4 collected or all exhausted.
   - Result: 1 shot × 4 variants → 4 images from that shot; 4 shots × 3 variants → 1 image per shot. The collage renders however many slots are filled (1–4), same 2×2 visual.

### B. New photoshoot wizard (`/photoshoot/new`)

New step machine: **`compose → configure → review → submit`**.

**Compose** (new, mirrors campaign `PromptStep`):
- Prompt `<textarea>` ("describe the photoshoot you want").
- `AssetCatalogPicker` to select **one product + reference images** (reuse the shared picker; product+refs both flow through `referenceAssetIds` as `product:`/`asset:` prefixed ids). Product selection is required to anchor the shoot; references optional.
- Primary action calls `POST /api/photoshoot/draft` → advances to configure with LLM results.

**Configure** (was `brief`; image `image copy.png`):
- **Read-only display** of the chosen product + reference thumbnails (not editable here).
- **Name** — free-text `<input>`, defaults to the LLM-suggested title (or product name), fully user-editable, **not linked to product name**. Persisted as the photoshoot `title`.
- **Prompt** — editable `<textarea>`, prefilled with the LLM-improved photoshoot prompt.
- **Styles** — the template chips, with the LLM-preselected `templateIds` toggled on. User can toggle. Improved `styleNotes` (see D).
- **Ratio** — chips now include **16:9** (`1:1 · 4:5 · 9:16 · 16:9`).
- **Variants** — stepper (1–4), unchanged.
- **Live Buzz estimate** — `useCampaignPreview`-equivalent against `/api/photoshoot/preview`, shown as a `BuzzPill`; recomputed on prompt/style/ratio/variant change (debounced).
- Advances to review.

**Review** (image `image copy 3.png`):
- **One card per selected style** (one per `templateId`), labeled by the template label (e.g. `studio · clean`, `lifestyle · in-use`, `lifestyle · kitchen`) — **not** collapsed by group. Fixes "selected three styles, only two shown."
- **Inline-editable final prompt** per card: the prompt textarea is always visible/editable (no `+ edit raw prompt` toggle). Edits set the per-template `userOverride`.
- Keep the "show what we added from your brand" expander (brand/style/base/negative layers) — informational only.
- Live total Buzz estimate.
- Cook button → `POST /api/photoshoot/cook`.

**LLM draft API** — `POST /api/photoshoot/draft` (mirrors `/api/campaigns/draft`):
- Body: `{ prompt, referenceAssetIds, productName? }`.
- New lib fn `generatePhotoshootDraft` (in `src/lib/adCopy.ts` or a sibling `src/lib/photoshootDraft.ts`) following `generateCampaignDraft`'s structure (same OpenRouter client, model chain, JSON-mode-with-fallback, transient retry, local fallback when key missing / all fail).
- Returns `{ draft: { title, prompt, templateIds }, meta }` where `prompt` is the improved photoshoot prompt, `templateIds` ⊆ the 7 known templates, `title` a suggested name. The LLM is given the available templates (id + label + styleNotes) and asked to pick the best-fitting subset.
- Fallback (no key / failure): `prompt` = user's prompt, `templateIds` = `recommendedTemplateIds()`, `title` = productName || "Photoshoot".

**Cook / estimate image delivery** — confirm `/api/photoshoot/cook` and `/api/photoshoot/preview` pass the full `referenceAssetIds` (product + references) through `getPublicUrls` → `images[]`. Because the product is selected via `AssetCatalogPicker` as `product:<id>`, the product hero image is delivered as a reference image. No new mechanism — verify and (if the wizard previously special-cased "subject") ensure the product id reaches `referenceAssetIds`.

### C. Aspect ratio 16:9

- `PhotoshootRatio` → add `'16:9'` (`src/lib/photoshootTemplates.ts`).
- Photoshoot cook + preview Zod `ratio` enums → add `'16:9'`.
- `buildPhotoshootPrompt` already maps ratio straight through; `EnhancedPrompt.aspectRatio` / orchestrator already accept `16:9`.
- Configure-step ratio chips → add the 16:9 option.

### D. Improve style prompts

Rewrite the 7 `styleNotes` in `photoshootTemplates.ts` for stronger, more consistent product photography results (keep ids/labels/groups stable so existing data and `recommendedTemplateIds` keep working). Each should specify subject framing, lighting, background/setting, lens/DoF, and a quality clause, while staying concise. Content-only change; no structural change.

### E. Details page (`/photoshoot/[id]`)

Rebuild `PhotoshootResults` to the campaign details layout (`CampaignCreativeRow` style):
1. **Row per style** — group tiles by `templateId`; render one row per style. Header = template label + a "N variants" count. Body = `flex gap-3 overflow-x-auto pb-1` of variant thumbs, where each variant = one output image of that tile (assets by `sourceTileId`, ordered; skeletons for still-cooking expected variants up to `quantity`).
2. **Remove** the `linkedin · 1:1` preset badge and the `ratioToPresetId` hint.
3. **Per-variant actions** — each thumb gets an overflow `⋮` menu mirroring campaigns plus the relocated CTAs: **Edit** (creative editor, when the image has an asset), **Download**, **Use as product image**, **Use in campaign**, and the existing **Regenerate** ("redo") at the row level (regenerate is per-tile/style). This replaces the select-mode + bottom bulk bar.
4. **Header cleanup** — keep breadcrumb + inline-editable title; **remove** the source-product / "// N templates · shots" text between them. Keep the status line (e.g. "N of M shots ready · K cooking") only if it stays below the title, not between breadcrumb and title.

---

## Components & boundaries

| Unit | Responsibility | Notes |
|---|---|---|
| `PhotoshootList` | grid + cover collage | label + column + uses richer `thumbUrls` |
| `listPhotoshoots` | round-robin cover URLs | gather all images per tile |
| `generatePhotoshootDraft` + `/api/photoshoot/draft` | LLM prompt+style draft | mirror campaign draft; own fallback |
| `PhotoshootWizard` | compose → configure → review → submit | reuse `AssetCatalogPicker`, `BuzzPill`, preview hook |
| Photoshoot review card | one per template, inline-editable prompt | replaces toggle + group collapse |
| `photoshootTemplates.ts` | template data + ratio type | add 16:9, improve styleNotes |
| `/api/photoshoot/preview` & `/cook` | estimate + submit | accept 16:9; verify image delivery |
| `PhotoshootResults` + new row component | campaign-style rows + per-variant menu | remove badge/bulk-bar/middle text |

---

## Testing

- `pnpm typecheck` for all `src/` changes.
- `pnpm test:e2e` `60-photoshoot` spec (cooks against MSW-mocked orchestrator) — update/extend for: compose→configure→review flow, draft call, 16:9 option, per-style review cards, details row layout. MSW handler for `/api/photoshoot/draft` if the spec exercises it (mirror campaign draft mock).
- Manual: confirm product+reference images reach the orchestrator request (`images[]` populated) in cook.
- Watch the two pre-existing red component suites (unrelated) — not regressions.

---

## Risks / decisions

- **Reuse vs extract**: we reuse the already-shared `AssetCatalogPicker`, `BuzzPill`, and the preview-hook pattern, but **replicate** the compose-step markup inside `PhotoshootWizard` rather than extracting a shared `<PromptComposer>` — keeps the campaign wizard untouched and lower-risk. Functionally identical UX.
- **Variant model unchanged**: photoshoot tiles stay one-per-style/multi-image. Details "variants" = images within a tile (assets by `sourceTileId`). Regenerate stays per-tile (whole style).
- **Per-variant editing**: photoshoot variants are editable only where an image has a persisted asset; not adding the campaign per-variant-tile split.
- **Existing photoshoots**: older shoots still render in the new details layout (grouped by `templateId`); covers recompute from existing assets. No migration.
