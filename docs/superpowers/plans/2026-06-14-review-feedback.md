# Review Feedback 2026-06-14 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote catalog + assets to top-level sections (out of `/brand`), tighten the Brand DNA editor, fold product editing into the detail page, and make ad-hoc image generation use the campaign-style cooking-card + live-polling flow.

**Architecture:** Next.js 16 App Router. Phase 1 moves route directories and rewires every internal reference/nav entry so later UI tasks build on final paths. Phases 2–4 layer UX changes per surface. Backend uses Drizzle; the `assets.sourceTileId` column already separates ad-hoc generated assets (null) from campaign/photoshoot ones (non-null). No schema migration.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind 3.4, Drizzle ORM, lucide-react icons, vitest (unit), Playwright (e2e).

**Conventions:**
- Lowercase UI copy (e.g. `// catalog`, `new product`) matches existing style.
- Eyebrows render via `<span className="t-eyebrow">// foo</span>`.
- Run a single unit test file with `pnpm exec vitest run <path>`.
- Typecheck with `pnpm typecheck`. Lint with `pnpm lint`.
- Commit after each task. Branch is `feature/review-feedback-2026-06-14` (already created).

---

## Phase 1 — Routing moves

### Task 1: Move catalog routes out of `/brand`, delete the edit route

**Files:**
- Move dir: `src/app/(app)/brand/catalog/` → `src/app/(app)/catalog/`
- Delete: `src/app/(app)/catalog/[id]/edit/page.tsx` (after move)
- Modify references: `src/components/catalog/CatalogGrid.tsx`, `CatalogControls.tsx`, `ProductDetail.tsx`, `ProductDetailGallery.tsx`, `AddProductForm.tsx`, `DeleteProductButton.tsx`, `ProductPickerDialog.tsx`, `src/components/photoshoot/PhotoshootResults.tsx`, `src/components/pickers/AssetCatalogPicker.tsx`, `src/components/assets/AssetsEmptyState.tsx`
- Modify nav: `src/components/shell/nav.ts`, `src/components/shell/BrandSubTabs.tsx`, `src/components/shell/AppShell.tsx`

- [ ] **Step 1: Move the route directory with git**

```bash
git mv "src/app/(app)/brand/catalog" "src/app/(app)/catalog"
git rm -r "src/app/(app)/catalog/[id]/edit"
```

Expected: `src/app/(app)/catalog/{page.tsx,new/page.tsx,[id]/page.tsx}` exist; the `[id]/edit` dir is gone.

- [ ] **Step 2: Find every catalog path reference**

Run:
```bash
grep -rn "/brand/catalog" src
```
Expected: a list across the component files named above (plus tests). Replace **every** `/brand/catalog` occurrence with `/catalog`. Note the `[id]/edit` references will be removed entirely in Task 8 (inline edit) — for now, in `CatalogControls.tsx` CardMenu and `ProductDetail.tsx`/`ProductDetailGallery.tsx`, change `/brand/catalog/{id}/edit` → `/catalog/{id}/edit` (it still resolves to a 404 until Task 8 removes the edit affordance; that's acceptable mid-migration, but prefer to also do the edit-route refs here only as a string swap — Task 8 removes them).

- [ ] **Step 3: Apply the replacements**

Edit each file so all hrefs/`router.push`/`redirect`/default `redirectTo` use `/catalog…`. Key spots:
- `CatalogGrid.tsx`: `/brand/catalog/new` (×3: desktop btn, empty-state CTA, mobile FAB) → `/catalog/new`. The empty-state secondary link `/brand/assets/new` is handled in Task 2.
- `CatalogControls.tsx`: GridCard link, ListRow link → `/catalog/{id}`; CardMenu edit → `/catalog/{id}/edit` (removed in Task 8); bottom CTA `/brand/catalog/new` → `/catalog/new` (removed in Task 5).
- `ProductDetail.tsx`: back button → `/catalog`; `editHref` passed to gallery → `/catalog/{id}/edit` (removed Task 8).
- `ProductDetailGallery.tsx`: delete-product `router.push('/brand/catalog')` → `/catalog`.
- `AddProductForm.tsx`: default `redirectTo = '/catalog'`.
- `DeleteProductButton.tsx`: post-delete `router.push('/catalog')`.
- `ProductPickerDialog.tsx`: `buildNewProductHref` → `/catalog/new?images=...`.
- `PhotoshootResults.tsx`: post-pick `router.push('/catalog/{productId}')`.
- `AssetCatalogPicker.tsx`, `AssetsEmptyState.tsx`: catalog CTA hrefs → `/catalog…`.

- [ ] **Step 4: Update nav + active-state detection**

- `nav.ts`: change the catalog entry `href: '/brand/catalog'` → `href: '/catalog'` and its active-detection pair `['/brand/catalog', 'catalog']` → `['/catalog', 'catalog']`. Promote it from a brand-indented child to a top-level entry (`indent: false` or remove `indent`); keep order sensible (Brand DNA, Catalog, Assets, Campaigns, Photoshoot — match current visual order).
- `BrandSubTabs.tsx`: remove the catalog sub-tab entry (`{ id: 'catalog', href: '/brand/catalog' }`).
- `AppShell.tsx`: update the pathname check that maps `/brand/catalog` to the catalog sub-tab — switch it to mark the top-level `catalog` nav active for `/catalog` and `/catalog/...`.

- [ ] **Step 5: Verify no stale references and typecheck**

Run:
```bash
grep -rn "/brand/catalog" src ; pnpm typecheck
```
Expected: grep prints nothing; typecheck passes with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(catalog): move routes to /catalog and delete edit route dir"
```

---

### Task 2: Move assets routes out of `/brand`

**Files:**
- Move dir: `src/app/(app)/brand/assets/` → `src/app/(app)/assets/`
- Modify references: `src/components/assets/AssetsGallery.tsx`, `AssetUploader.tsx`, `AssetDetailView.tsx`, `AssetsEmptyState.tsx`, `src/components/catalog/CatalogGrid.tsx` (empty-state secondary link), `ProductDetailGallery.tsx`, `ProductPickerDialog.tsx`
- Modify nav: `src/components/shell/nav.ts`, `BrandSubTabs.tsx`, `AppShell.tsx`

- [ ] **Step 1: Move the route directory with git**

```bash
git mv "src/app/(app)/brand/assets" "src/app/(app)/assets"
```
Expected: `src/app/(app)/assets/{page.tsx,new/page.tsx,[id]/page.tsx}` exist.

- [ ] **Step 2: Find every assets path reference**

Run:
```bash
grep -rn "/brand/assets" src
```
Expected: list across the files above (plus tests). Replace all `/brand/assets` → `/assets` (so `/brand/assets/new` → `/assets/new`, `/brand/assets/{id}` → `/assets/{id}`).

- [ ] **Step 3: Apply the replacements**

Edit each file. Key spots: `AssetsGallery` upload Link + mobile FAB; `AssetUploader` cancel/redirect; `AssetDetailView` back link; `AssetsEmptyState` dropzone + generate links; `CatalogGrid` empty-state secondary "upload assets" link; gallery/picker references.

- [ ] **Step 4: Update nav + active-state detection**

- `nav.ts`: assets entry `href: '/brand/assets'` → `/assets`, active pair → `['/assets', 'assets']`, promote to top-level.
- `BrandSubTabs.tsx`: remove the assets sub-tab. After removing catalog (Task 1) and assets, `BrandSubTabs` may have only one tab (brand dna) — if so, render nothing / remove its usage from the brand layout. Decide based on remaining tabs; if it would render a single tab, delete the component usage and the file.
- `AppShell.tsx`: update `/brand/assets` route detection to mark top-level `assets` active for `/assets` and `/assets/...`.

- [ ] **Step 5: Verify and typecheck**

Run:
```bash
grep -rn "/brand/assets" src ; pnpm typecheck
```
Expected: grep prints nothing; typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(assets): move routes to /assets and promote nav entry"
```

---

## Phase 2 — Brand DNA

### Task 3: Rescrape endpoint (no onboarding-payload mutation)

**Files:**
- Create: `src/app/api/brand/[id]/rescrape/route.ts`
- Reference: `src/lib/scrape.ts` (`scrapeSite`, `ScrapeError`), `src/lib/brand.ts` (`getBrand`/lookup), `src/lib/session.ts`, `src/lib/userKey.ts`, `src/app/api/onboarding/scrape/route.ts` (shape to mirror, minus persistence)

- [ ] **Step 1: Read the existing scrape route and brand lib**

Read `src/app/api/onboarding/scrape/route.ts` and `src/lib/brand.ts` to confirm: how `scrapeSite` is called and its return shape (`ScrapedSite`), and how a brand is fetched scoped to the user (find the brand-by-id helper; if none, query `brandProfiles` by `id` + `userId`).

- [ ] **Step 2: Write the route handler**

```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { db } from '@/lib/db';
import { brandProfiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { scrapeSite, ScrapeError } from '@/lib/scrape';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userKey = await getUserKey(session);
  const { id } = await params;

  const [brand] = await db
    .select({ id: brandProfiles.id, sourceUrl: brandProfiles.sourceUrl })
    .from(brandProfiles)
    .where(and(eq(brandProfiles.id, id), eq(brandProfiles.userId, userKey)))
    .limit(1);
  if (!brand) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!brand.sourceUrl) {
    return NextResponse.json({ error: 'no_source_url' }, { status: 400 });
  }

  try {
    const scraped = await scrapeSite(brand.sourceUrl);
    return NextResponse.json({ scraped });
  } catch (err) {
    if (err instanceof ScrapeError) {
      return NextResponse.json({ error: err.code }, { status: 422 });
    }
    return NextResponse.json({ error: 'scrape_failed' }, { status: 500 });
  }
}
```

Adjust imports/signatures to match the actual `getUserKey`/session API and the brand table column names confirmed in Step 1.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/brand/[id]/rescrape/route.ts
git commit -m "feat(brand): add /api/brand/[id]/rescrape returning scraped fields"
```

---

### Task 4: Brand DNA editor — dirty gating, read-only URL, labels, merged card, rescrape, save spinner

**Files:**
- Modify: `src/components/brand/BrandEditor.tsx`

- [ ] **Step 1: Read `BrandEditor.tsx` in full**

Confirm current state: form fields (`name`, `description`, `sourceUrl`, `industry`, `tagline`, `font`, `logoUrl`, `palette`, `voice`, `values`, `aesthetic`), the `busy`/`error`/`saved` flags, the `EditorCard` and `FieldLabel`/`TagInput` helpers, the identity card (lines ~422-465), tagline card (~503-512), description card (~569-578), and the save button (~637-644).

- [ ] **Step 2: Add a dirty-tracking helper**

Capture the initial brand snapshot and compute `dirty`. Add near the top of the component, after state declarations:

```tsx
const initial = useMemo(
  () => ({
    name: brand.name,
    description: brand.description ?? '',
    sourceUrl: brand.sourceUrl ?? '',
    industry: brand.industry ?? '',
    tagline: brand.tagline ?? '',
    font: brand.font ?? '',
    logoUrl: brand.logoUrl ?? null,
    palette: brand.palette,
    voice: brand.tone ? brand.tone.split(',').map((s) => s.trim()).filter(Boolean) : [],
    values: brand.values,
    aesthetic: brand.aesthetic,
  }),
  [brand],
);

const dirty = useMemo(() => {
  const eqArr = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  return (
    name !== initial.name ||
    description !== initial.description ||
    industry !== initial.industry ||
    tagline !== initial.tagline ||
    font !== initial.font ||
    (logoUrl ?? null) !== initial.logoUrl ||
    !eqArr(palette, initial.palette) ||
    !eqArr(voice, initial.voice) ||
    !eqArr(values, initial.values) ||
    !eqArr(aesthetic, initial.aesthetic)
  );
}, [name, description, industry, tagline, font, logoUrl, palette, voice, values, aesthetic, initial]);
```

Ensure `useMemo` is imported from `react`. (Note: `sourceUrl` is excluded from `dirty` because it becomes read-only; rescrape mutates other fields which re-enables Save.)

- [ ] **Step 3: Gate the Save button on dirty + add explicit spinner**

Change the save button's `disabled` to `busy || !name.trim() || !dirty`. Ensure the in-flight state shows a spinner — use the lucide `Loader2` icon with `className="animate-spin"` while `busy`, and the `Save` icon otherwise. After a successful save, `router.refresh()` already re-seeds `brand` (the snapshot recomputes via `useMemo` keyed on `brand`), so `dirty` returns false.

- [ ] **Step 4: Make the brand URL read-only once set**

In the identity card, replace the `sourceUrl` `<Input>` with: if `initial.sourceUrl` is non-empty, render read-only hostname text + a "rescrape" button (Step 6); only render an editable URL `<Input>` when `initial.sourceUrl` is empty. Remove `sourceUrl` from the editable state path used by Save when read-only (still send the stored value in the PATCH body so it round-trips unchanged).

- [ ] **Step 5: Add field labels + merge tagline into the identity card**

- Add `<FieldLabel>` above each identity input: "brand name", "industry", "url".
- Move the tagline field out of its standalone card into the description card so tagline + description live on one card (per spec B3). Add `<FieldLabel>` "tagline" and "description" there. Delete the now-empty standalone tagline `EditorCard`.

- [ ] **Step 6: Wire the rescrape button**

Add state `const [rescraping, setRescraping] = useState(false);` and a handler:

```tsx
async function onRescrape() {
  setRescraping(true);
  setError(null);
  try {
    const res = await fetch(`/api/brand/${brand.id}/rescrape`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) {
      setError(body?.error ?? `http ${res.status}`);
      return;
    }
    const s = body.scraped as {
      palette?: string[]; font?: string | null;
      logoUrl?: string | null; description?: string | null;
    };
    if (s.palette && s.palette.length) setPalette(s.palette.slice(0, 12));
    if (s.font) setFont(s.font);
    if (s.logoUrl) setLogoUrl(s.logoUrl);
    if (s.description) setDescription(s.description);
  } catch {
    setError('rescrape failed');
  } finally {
    setRescraping(false);
  }
}
```

Render the button next to the read-only URL with a `RefreshCw` lucide icon, label "rescrape", disabled while `rescraping` (show `Loader2 animate-spin` while in flight). Repopulated fields make the form dirty → Save enables.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add src/components/brand/BrandEditor.tsx
git commit -m "feat(brand): dirty-gated save, read-only url + rescrape, field labels, merged tagline/description card"
```

---

## Phase 3 — Catalog UX

### Task 5: Catalog list — remove bottom CTA, add context-menu icons

**Files:**
- Modify: `src/components/catalog/CatalogControls.tsx`

- [ ] **Step 1: Remove the bottom "add another product" CTA**

Delete the block at the end of the grid/list (the Link with Plus icon + "add another product", ~lines 340-346). The header CTA in `CatalogGrid` + mobile FAB remain the single entry point.

- [ ] **Step 2: Add icons to the CardMenu options**

In `CardMenu` (~lines 86-109), add a leading lucide icon to each option: `Pencil` (14px) before "edit", `Trash2` (14px) before "delete". Import them from `lucide-react`. Keep the existing classes; place the icon inside the button before the label text with `inline-flex items-center gap-2`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/CatalogControls.tsx
git commit -m "feat(catalog): drop bottom add CTA, add icons to card context menu"
```

---

### Task 6: New product page — back button + eyebrow

**Files:**
- Modify: `src/app/(app)/catalog/new/page.tsx`

- [ ] **Step 1: Replace eyebrow + add back button**

In the page header: change the eyebrow text `brand DNA · new` → `// catalog`. Add a back button above/beside the heading linking to `/catalog`, styled as the existing pill back button (match `ProductDetail.tsx` back-button markup: `Link` with `ArrowLeft` 14px + label "catalog", classes `border-line-subtle bg-bg-2` pill). Import `ArrowLeft` from `lucide-react` and `Link` from `next/link`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/catalog/new/page.tsx"
git commit -m "feat(catalog): back button + // catalog eyebrow on new product page"
```

---

### Task 7: Product detail — header CTAs, live badge, image-action contrast/radius, single carousel upload

**Files:**
- Modify: `src/components/catalog/ProductDetail.tsx`, `src/components/catalog/ProductDetailGallery.tsx`

- [ ] **Step 1: Move CTAs into the header row (ProductDetail.tsx)**

The detail header currently has back button + status badge (lines ~24-42), and the CTAs live in the gallery action bar. Restructure the header into one flex row: left = back button; right = primary "use in campaign" Button + secondary "use in photoshoot" Button + the context `MoreMenu` button. Pass `campaignHref`/`photoshootHref`/`editHref` into the header (they currently flow into the gallery). Use the `Button` component:
- Primary: `<Button as Link href={campaignHref} variant="primary">` with a `Megaphone` (or `Sparkles`) leading icon, label "use in campaign".
- Secondary: `variant="secondary"` Link to `photoshootHref` with a `Camera` leading icon, label "use in photoshoot".
Remove the photoshoot/campaign CTAs and `MoreMenu` from the gallery action bar (Step 4) since they now live in the header.

- [ ] **Step 2: Live/status badge above the title, remove `// product` eyebrow**

In the right metadata column, remove the `// product` eyebrow. Render the status badge (live/draft/archived) directly above the product title (move the badge JSX from the header into the title block, above the `<h1>`).

- [ ] **Step 3: Consistent border radius for header actions**

Ensure the back button, both CTAs, and the MoreMenu button share the same radius class (pick the existing convention, e.g. `rounded-full` for pills or the `Button` default — make all four match).

- [ ] **Step 4: Gallery — remove duplicated CTAs, improve image-action contrast, single upload, uniform radius (ProductDetailGallery.tsx)**

- Remove the action bar's photoshoot CTA, campaign CTA, and `MoreMenu` (now in the header). If `MoreMenu`/`onEdit`/`onDelete` are still needed for delete, keep delete reachable via the header MoreMenu instead (wire the header menu to the gallery's delete/ edit handlers, or lift those handlers up). Keep the gallery focused on the image strip.
- Hero top-right overlay buttons (wand/delete, ~lines 314-338): improve contrast — give the buttons a solid/opaque dark background (e.g. `bg-bg-0/80 hover:bg-bg-0` + `text-fg-0`) instead of the low-contrast translucent style, so they're readable over any image.
- Photo strip add/upload (~lines 364-388): **remove the "add" button**, keep only the "upload" button (they trigger the same file input).
- Make all action buttons in the gallery share one radius class (match the header convention from Step 3).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/catalog/ProductDetail.tsx src/components/catalog/ProductDetailGallery.tsx
git commit -m "feat(catalog): header CTAs (primary/secondary), live badge above title, contrast + single upload on gallery"
```

---

### Task 8: Inline product edit (replace the edit page)

**Files:**
- Modify: `src/components/catalog/ProductDetail.tsx` (right panel becomes editable)
- Repurpose/Modify: `src/components/catalog/EditProductForm.tsx` → an inline-editable metadata panel, OR extract its field logic into the detail panel
- Modify: `src/components/catalog/index.ts` (exports)
- Remove leftover edit-route references (`editHref`) across `ProductDetail.tsx`, `ProductDetailGallery.tsx`, `CatalogControls.tsx`

- [ ] **Step 1: Read EditProductForm.tsx and ProductDetail.tsx**

Confirm the editable fields (name, description/notes, tags, status) and the PATCH submit (`PATCH /api/catalog/products/[id]` with `{ name, notes, tags, status, imageAssetIds }`). Note that image management already lives in `ProductDetailGallery` on the detail page; the inline edit only needs the scalar metadata fields (name, description, tags, status) — images stay in the gallery.

- [ ] **Step 2: Make the right metadata panel toggle to edit mode**

Convert the right column of `ProductDetail` into a client component (or wrap the metadata block in a small `'use client'` `ProductMetaPanel` component) holding `editing` state. Read mode shows name/tags/notes/meta as today. An "edit" affordance (from the header MoreMenu's "edit product" option, or a pencil button on the panel) sets `editing = true`, swapping the display into inputs:
- name `<Input>` (required)
- description `<Textarea>`
- tags `<Input>` (comma-separated, reuse the chip parsing pattern from `EditProductForm`)
- status `<Select>` (live/draft/archived)

```tsx
async function save() {
  setSaving(true);
  setError(null);
  const res = await fetch(`/api/catalog/products/${product.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      notes: description.trim() || undefined,
      tags,
      status,
    }),
  });
  setSaving(false);
  if (!res.ok) { setError('save failed'); return; }
  setEditing(false);
  router.refresh();
}
```

Save button shows a spinner while `saving`; Cancel reverts state to the product props and exits edit mode. (Do not send `imageAssetIds` — leave images untouched by the inline metadata save.)

- [ ] **Step 3: Remove the edit-route affordance + references**

- Header MoreMenu "edit product" now toggles inline edit (calls `setEditing(true)`), not `router.push(editHref)`.
- `CatalogControls.tsx` CardMenu "edit" option: change to link to `/catalog/{id}` (the detail page) — or keep "edit" but route to detail; simplest is to keep a single "edit" that opens the detail page where inline editing lives. Remove the `/edit` href.
- Delete any remaining `editHref` props and `/catalog/[id]/edit` strings.

- [ ] **Step 4: Delete EditProductForm if fully unused**

After inlining, run `grep -rn "EditProductForm" src`. If nothing references it, delete `src/components/catalog/EditProductForm.tsx` and remove its export from `index.ts`. If you reused it as the inline panel, keep it but ensure no page route imports it.

- [ ] **Step 5: Verify no edit-route references and typecheck**

Run:
```bash
grep -rn "catalog/\[id\]/edit\|/edit'\|editHref" src ; pnpm typecheck
```
Expected: no stale edit-route refs (the `[id]/edit` directory was already deleted in Task 1); typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(catalog): inline metadata editing on product detail, remove edit page"
```

---

## Phase 4 — Assets UX

### Task 9: Library asset filter (exclude campaign/photoshoot generated)

**Files:**
- Modify: `src/lib/assets.ts`
- Test: `src/lib/assets.test.ts` (extend existing)
- Modify: `src/app/(app)/assets/page.tsx` (use the new helper)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/assets.test.ts` a test that the library query excludes generated assets with a non-null `sourceTileId` and keeps uploads + ad-hoc generated. Match the existing test style in that file (check how it stubs `db`). If the existing tests are pure (no DB), assert on the query predicate construction; if they hit a test DB, insert: one upload (kind!=generated, sourceTileId null), one ad-hoc generated (kind generated, sourceTileId null), one campaign generated (kind generated, sourceTileId set), then assert `listLibraryAssets` returns the first two only.

```ts
// shape depends on existing test harness in assets.test.ts — follow it.
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm exec vitest run src/lib/assets.test.ts`
Expected: FAIL (`listLibraryAssets` undefined).

- [ ] **Step 3: Implement `listLibraryAssets`**

```ts
import { and, desc, eq, isNull, isNotNull, not } from 'drizzle-orm';

export async function listLibraryAssets(userId: string, limit = 200): Promise<Asset[]> {
  const rows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.userId, userId),
        isNull(assets.deletedAt),
        // exclude campaign/photoshoot generated images (they have their own pages)
        not(and(eq(assets.kind, 'generated'), isNotNull(assets.sourceTileId))!),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(limit);
  return rows.map(toAsset);
}
```

Confirm `not`/`isNotNull` are valid imports from `drizzle-orm` in this version; if `not(and(...))` typing is awkward, express it as `or(ne(assets.kind, 'generated'), isNull(assets.sourceTileId))` instead.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm exec vitest run src/lib/assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the assets list page**

In `src/app/(app)/assets/page.tsx`, replace `listAssets(userKey, 200)` with `listLibraryAssets(userKey, 200)`.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/assets.ts src/lib/assets.test.ts "src/app/(app)/assets/page.tsx"
git commit -m "feat(assets): library list excludes campaign/photoshoot generated images"
```

---

### Task 10: Assets list — CTAs in title row + sort dropdown

**Files:**
- Modify: `src/components/assets/AssetsGallery.tsx`

- [ ] **Step 1: Read AssetsGallery.tsx**

Confirm: header (eyebrow/title in the page), the toolbar with Generate + Upload buttons (~lines 101-115), grid/list toggle (~117-149), filter pills, and the `viewMode` state. Note `genOpen` state + `AdHocGenerationModal` at ~191-195.

- [ ] **Step 2: Move Upload + Generate into the title row**

The page title row (in `src/app/(app)/assets/page.tsx` header, or the top of `AssetsGallery`) should mirror `/catalog`: title on the left, CTAs on the right — **Upload = primary** (Link to `/assets/new`, `Upload` icon), **Generate = secondary** (button that opens the ad-hoc modal, `Sparkles` icon). Remove these two buttons from the toolbar. If the title lives in the RSC page and CTAs need client state (Generate opens a modal), keep the CTA cluster inside `AssetsGallery` rendered at the top, aligned right, in the same row as the heading — pass the heading text down or render the heading inside the gallery. Choose the minimal restructure that puts both CTAs beside the title.

- [ ] **Step 3: Add a sort dropdown next to the view toggle**

Add `const [sort, setSort] = useState<'recent' | 'name' | 'type'>('recent');`. Render a `<Select>` next to the grid/list toggle (mirror `CatalogControls` placement). Sort the rendered assets accordingly:
- `recent`: by `createdAt` desc (current default).
- `name`: by a display name (storageKey/filename or metadata) asc.
- `type`: by `metadata.collection ?? kind`.
Apply the sort to each rendered group/list before mapping to tiles.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/components/assets/AssetsGallery.tsx "src/app/(app)/assets/page.tsx"
git commit -m "feat(assets): upload/generate CTAs in title row, sort dropdown by view toggle"
```

---

### Task 11: New asset page — back button, eyebrow, upload-only, file types, save icon

**Files:**
- Modify: `src/app/(app)/assets/new/page.tsx`, `src/components/assets/AssetUploader.tsx`

- [ ] **Step 1: Page header — back button + eyebrow (new/page.tsx)**

Change eyebrow `brand DNA · upload` → `// upload`. Add a back button (Link to `/assets`, `ArrowLeft` + "assets" pill) matching the catalog new-page pattern from Task 6.

- [ ] **Step 2: Remove the upload/pick-from-library tabs (AssetUploader.tsx)**

Remove the `TabStrip` and the "pick from library" tab + its `AssetCatalogPicker` (~lines 300-457). Render the upload dropzone directly (no tabs). Remove now-unused state (`tab`, library-promote state) and the `hasLibrary` branch. Keep the metadata section (collection/tags/description) and the staged-files list.

- [ ] **Step 3: Restrict accepted file types to svg/png/jpg**

Change the file input `accept` from `image/*,video/*,application/pdf` to `.svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg`. Add a client-side guard in the file-staging handler that rejects files whose type isn't svg/png/jpeg (show an inline error). Update the dropzone helper copy from "jpg · png · webp …" to "svg · png · jpg — up to 20 mb each".

- [ ] **Step 4: Change the submit button icon to Save**

Replace the `Sparkles` leading icon on the "add to library" submit button with the lucide `Save` icon. Keep the label.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add "src/app/(app)/assets/new/page.tsx" src/components/assets/AssetUploader.tsx
git commit -m "feat(assets): upload-only new page with back button, // upload eyebrow, svg/png/jpg, save icon"
```

---

### Task 12: Ad-hoc modal polish — autofocus, accordion chevron-only, assets-only references

**Files:**
- Modify: `src/components/assets/AdHocGenerationModal.tsx`
- Modify: `src/components/pickers/AssetCatalogPicker.tsx` (assets-only mode, if needed)
- Test: `src/components/assets/AdHocGenerationModal.test.tsx`

- [ ] **Step 1: Read the modal + its test**

Confirm FormView prompt textarea (id `adhoc-prompt`, ~lines 416-432), the negative-prompt toggle (~436-446) and reference-images toggle (~542-557) showing `"+ add …"` / `"− …"` text, and the reference `AssetCatalogPicker` (~560-564) currently with `initialTab="assets"` but still showing a products tab.

- [ ] **Step 2: Autofocus the prompt textarea**

Add a `ref` to the prompt `<Textarea>` and focus it on mount of FormView:

```tsx
const promptRef = useRef<HTMLTextAreaElement>(null);
useEffect(() => { promptRef.current?.focus(); }, []);
// <Textarea ref={promptRef} id="adhoc-prompt" ... />
```

If `Textarea` doesn't forward refs, add `autoFocus` to it as the fallback. Verify the modal mounts FormView fresh on open (it remounts on open/close per existing code) so autofocus fires each open.

- [ ] **Step 3: Remove the "+" from accordion toggles**

In both toggle buttons, change the label so there's no leading `+`/`−` sign — just the text (e.g. "negative prompt", "reference images") plus the existing `ChevronUp`/`ChevronDown` icon as the sole open/closed indicator.

- [ ] **Step 4: Reference picker = assets only**

Make the reference `AssetCatalogPicker` show only the assets (uploaded) tab — no products tab. Add an `assetsOnly?: boolean` prop to `AssetCatalogPicker` that hides the products tab and forces the assets tab; pass `assetsOnly` from the modal. Keep `includeGenerated={false}`. (If a quicker path exists — e.g. the picker already supports hiding a tab — use that.)

- [ ] **Step 5: Update the modal test**

In `AdHocGenerationModal.test.tsx`, update/add assertions: prompt input is focused on open; accordion toggles render no `+` (assert text content has no leading `+`); reference picker renders no products tab. Follow the existing test setup (RTL render, testids `adhoc-neg-toggle`, `adhoc-refs-toggle`).

- [ ] **Step 6: Run the test**

Run: `pnpm exec vitest run src/components/assets/AdHocGenerationModal.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/components/assets/AdHocGenerationModal.tsx src/components/pickers/AssetCatalogPicker.tsx src/components/assets/AdHocGenerationModal.test.tsx
git commit -m "feat(assets): ad-hoc modal autofocus, chevron-only accordions, assets-only references"
```

---

### Task 13: Ad-hoc generation cooking cards + live polling (remove selection step)

**Files:**
- Modify: `src/lib/generations.ts` (add `listActiveAdhocGenerations`)
- Test: a generations test file (extend existing `src/lib/generations.*.test.ts` if a suitable harness exists)
- Modify: `src/app/(app)/assets/page.tsx` (fetch active ad-hoc generations, pass to gallery)
- Modify: `src/components/assets/AssetsGallery.tsx` (render cooking placeholder cards that poll; remove reliance on modal results)
- Modify: `src/components/assets/AdHocGenerationModal.tsx` (Generate closes modal + signals parent; remove polling + results phases)
- Remove: `src/app/api/assets/generate/save/route.ts` + its tests (no longer used)

- [ ] **Step 1: Read generations.ts + the modal + workflow route**

Confirm: how generations are recorded (`recordGeneration` with `source: 'adhoc'`, status field, expected image count / `numImages` stored in `input`), how to query non-terminal generations, and that `src/app/api/workflow/[id]/route.ts` already calls `syncAssetsFromSnapshot` on terminal success (it does) which creates `generated` assets with `sourceTileId = null` for ad-hoc.

- [ ] **Step 2: Add `listActiveAdhocGenerations`**

```ts
export type ActiveAdhocGeneration = {
  workflowId: string;
  prompt: string;
  numImages: number;
};

export async function listActiveAdhocGenerations(
  userId: string,
): Promise<ActiveAdhocGeneration[]> {
  const rows = await db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.source, 'adhoc'),
        // non-terminal statuses only — match the status enum used in this table
        inArray(generations.status, ['pending', 'processing'] as const),
      ),
    )
    .orderBy(desc(generations.createdAt));
  return rows.map((r) => ({
    workflowId: r.workflowId,
    prompt: r.prompt ?? '',
    numImages: /* read from r.input?.numImages ?? 1 */ 1,
  }));
}
```

Adjust the status values to the actual generation-status enum (read it from `src/lib/db/schema.ts`), and read `numImages` from wherever the submit stored it (the `input` JSON). Import `generations`, `and`, `eq`, `inArray`, `desc` as needed.

- [ ] **Step 3: Fetch + pass active generations to the gallery**

In `src/app/(app)/assets/page.tsx`, call `listActiveAdhocGenerations(userKey)` and pass the result to `AssetsGallery` as `cooking={...}`.

- [ ] **Step 4: Render cooking placeholder cards in AssetsGallery**

Render one placeholder card per active ad-hoc generation at the top of the grid. Reuse the campaign cooking visual: a card with a placeholder glow / skeleton + a `cooking…` overlay that polls `/api/workflow/[id]?wait=15000` until `done`, then calls `router.refresh()` so the resolved assets appear from the DB. Extract or mirror the polling loop from `CreativeCard.tsx` (~lines 169-201). A minimal dedicated `CookingAssetCard` component is acceptable:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CookingAssetCard({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          const data = await res.json();
          if (data.done) { if (!cancelled) router.refresh(); return; }
        } catch {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, router]);
  return (/* skeleton tile with animate-pulse + "cooking…" label; red state if failed */);
}
```

- [ ] **Step 5: Modal — Generate closes + signals; remove polling/results phases**

In `AdHocGenerationModal.tsx`: on successful `POST /api/assets/generate` (returns `{ workflowId }`), call a new `onSubmitted(workflowId)` prop and close the modal — do **not** transition to polling/results. Delete the `'polling'` and `'results'` phases, `PollingView`, `ResultsView`, the long-poll effect, and the save call to `/api/assets/generate/save`. Keep the estimate effect and buzz `estimate` recording (handled server-side in `/api/assets/generate`). In `AssetsGallery`, the `onSubmitted` handler appends the new `workflowId` to a local `cooking` list (so the card appears immediately without a full reload) and optionally `router.refresh()`.

- [ ] **Step 6: Remove the unused save endpoint**

```bash
git rm "src/app/api/assets/generate/save/route.ts" "src/app/api/assets/generate/save/route.test.ts"
```
Then `grep -rn "generate/save" src` and remove any remaining references.

- [ ] **Step 7: Run tests + typecheck**

Run:
```bash
pnpm exec vitest run src/components/assets/AdHocGenerationModal.test.tsx
pnpm typecheck
```
Expected: modal test passes (update it if it asserted on removed polling/results phases — it should now assert Generate calls `onSubmitted` and closes); typecheck passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(assets): ad-hoc generation uses cooking cards + live polling, drop manual selection"
```

---

## Phase 5 — Verification

### Task 14: Full verification sweep

- [ ] **Step 1: Static checks**

Run:
```bash
grep -rn "/brand/catalog\|/brand/assets" src   # expect: nothing
pnpm typecheck                                  # expect: pass
pnpm lint                                        # expect: pass (fix any new violations)
```

- [ ] **Step 2: Unit tests**

Run: `pnpm test:unit`
Expected: pass. Note any pre-existing failures from MEMORY (2 component suites red on main) and confirm they are unchanged, not new regressions.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succeeds (routing + any security-header-relevant changes compile).

- [ ] **Step 4: e2e (if environment available)**

Run: `pnpm test:e2e`
Expected: campaigns + assets specs green. If specs assert on `/brand/catalog` or `/brand/assets` paths, update those assertions to the new paths. If the e2e environment (Civitai dev server) isn't available, note it as skipped rather than claiming pass.

- [ ] **Step 5: Final commit (if any test fixups)**

```bash
git add -A
git commit -m "test: update path assertions + fixups for review-feedback changes"
```

---

## Self-review notes (coverage map)

- Brand DNA B1–B6 → Tasks 3, 4.
- Catalog C1 (re-route) → Task 1; C2 icons → Task 5; C3 bottom CTA → Task 5; C4 clickable → Task 1 (verify); C5 new page → Task 6; C6 detail header/badge/contrast/single-upload/radius → Task 7; C7 inline edit + remove edit page → Tasks 1 (route delete) + 8.
- Assets D1 (re-route) → Task 2; D2 library filter → Task 9; D3 CTAs in title row → Task 10; D4 sort → Task 10; D5 modal polish → Task 12; D6 cooking cards → Task 13; D7 new page → Task 11.
- Routing A1–A4 → Tasks 1, 2.
- Verification → Task 14.
</content>
