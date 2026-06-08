# Cross-Flow UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user-owned asset, product, or photoshoot tile flow into any other creation surface without re-uploading. Closes three named gaps: photoshoot output → product/campaign, catalog product creation → library pick, photoshoot wizard → subject prefill.

**Architecture:** Reuse the existing deep-link pattern (`/campaigns/new?refs=…`) and extend it to product/photoshoot creation. Reuse `AssetCatalogPicker` as the picker primitive. Add one new server endpoint for "append assets to existing product." `productCreateSchema.imageAssetIds` and `photoshoots.referenceAssetIds[]` already exist — no schema migration needed.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Drizzle ORM · React 19 · Playwright E2E · Vitest unit · MSW for orchestrator mocks.

**Spec:** `docs/superpowers/specs/2026-06-08-cross-flow-ux-design.md`

---

## File Structure

**New files:**

- `src/app/api/catalog/products/[id]/images/route.ts` — `POST` handler that appends owned `assetIds` to a product's `product_assets` join. Validates ownership of both product and assets.
- `src/components/catalog/ProductPickerDialog.tsx` — modal listing user's products + "new product" shortcut. Wraps the new images endpoint.
- `tests/e2e/55-photoshoot-cross-flow.spec.ts` — covers tile menu → campaign deep-link, multi-select → existing product, multi-select → new product.
- `tests/e2e/35-catalog-picker.spec.ts` — covers library tab in `AddProductForm` and `AssetUploader`.
- `tests/e2e/65-photoshoot-subject.spec.ts` — covers `?subject=` deep-link prefill.

**Modified files:**

- `src/lib/catalog.ts` — add `appendProductImages()` helper (mirrors `createProduct`'s ownership-filter + join-insert logic).
- `src/lib/catalogSchema.ts` — add `appendImagesSchema` Zod schema.
- `src/components/campaigns/CreativeCard.tsx` — add `context?: 'campaign' | 'photoshoot'` prop; render kebab menu when `'photoshoot'`; support `selectMode` + `selected` props for multi-select.
- `src/components/photoshoot/PhotoshootResults.tsx` — add `select` toggle and sticky `BulkActionBar`.
- `src/components/catalog/AddProductForm.tsx` — tab strip; library tab embeds `AssetCatalogPicker` (assets-only); split staged list into `uploads` vs `imageAssetIds` on submit; read `?images=asset:…` on mount.
- `src/components/assets/AssetUploader.tsx` — tab strip; library tab → `PATCH /api/assets/[id]` with `brandId` + `collection`.
- `src/components/photoshoot/PhotoshootWizard.tsx` — subject sub-step with three options; read `?subject=asset:…` / `?subject=product:…` on mount; pre-fill `referenceAssetIds`.
- `src/components/assets/AssetDetailView.tsx` — add `use as photoshoot subject` link (already has `use in campaign`).
- `src/components/catalog/ProductDetail.tsx` — add `use as photoshoot subject` link.
- `src/app/(app)/photoshoot/new/page.tsx` — pass `defaultSubjectRef` from `?subject=` to `PhotoshootWizard`.
- `src/app/(app)/brand/catalog/new/page.tsx` — pass `defaultImageAssetIds` from `?images=` to `AddProductForm`.

Each task makes one self-contained change. Tests first, then minimal impl, then commit.

---

## Task 1: Append-images server endpoint

**Files:**
- Modify: `src/lib/catalogSchema.ts`
- Modify: `src/lib/catalog.ts`
- Create: `src/lib/catalog.test.ts` (if not already exists — check first; if exists, append the test)
- Create: `src/app/api/catalog/products/[id]/images/route.ts`

- [ ] **Step 1: Add Zod schema for append payload**

In `src/lib/catalogSchema.ts`, append after `productUpdateSchema`:

```ts
export const productImagesAppendSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(12),
});

export type ProductImagesAppendPayload = z.infer<typeof productImagesAppendSchema>;
```

- [ ] **Step 2: Write failing unit test for `appendProductImages`**

Create or extend `src/lib/catalog.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db/client';
import { users, assets as assetsTable, products as productsTable, productAssets } from './db/schema';
import { createProduct, appendProductImages, getProduct } from './catalog';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('appendProductImages', () => {
  let userId: string;
  let foreignUserId: string;
  let productId: string;
  let ownedAssetIds: string[];
  let foreignAssetId: string;

  beforeEach(async () => {
    userId = `u_${randomUUID()}`;
    foreignUserId = `u_${randomUUID()}`;
    await db.insert(users).values([
      { id: userId, civitaiId: userId, username: userId, createdAt: new Date(), updatedAt: new Date() },
      { id: foreignUserId, civitaiId: foreignUserId, username: foreignUserId, createdAt: new Date(), updatedAt: new Date() },
    ]);
    ownedAssetIds = await Promise.all(
      [0, 1, 2].map(async () => {
        const [row] = await db.insert(assetsTable).values({
          userId, kind: 'upload', bucket: 'assets', storageKey: `assets/${randomUUID()}/x.png`,
        }).returning({ id: assetsTable.id });
        return row.id;
      }),
    );
    const [foreign] = await db.insert(assetsTable).values({
      userId: foreignUserId, kind: 'upload', bucket: 'assets', storageKey: `assets/${randomUUID()}/x.png`,
    }).returning({ id: assetsTable.id });
    foreignAssetId = foreign.id;
    const product = await createProduct({ userId, name: 'pant', tags: [], status: 'live', imageAssetIds: [ownedAssetIds[0]] });
    productId = product.id;
  });

  it('appends owned assets to the join, ignoring foreign ones', async () => {
    const result = await appendProductImages({
      userId,
      productId,
      assetIds: [ownedAssetIds[1], ownedAssetIds[2], foreignAssetId],
    });
    expect(result.addedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    const rows = await db.select().from(productAssets).where(eq(productAssets.productId, productId));
    expect(rows).toHaveLength(3);
  });

  it('is idempotent — duplicates are skipped not errored', async () => {
    const result = await appendProductImages({
      userId,
      productId,
      assetIds: [ownedAssetIds[0], ownedAssetIds[1]],
    });
    expect(result.addedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('returns null when product is not owned', async () => {
    const result = await appendProductImages({
      userId: foreignUserId,
      productId,
      assetIds: [ownedAssetIds[1]],
    });
    expect(result).toBeNull();
  });
});
```

Run: `pnpm vitest run src/lib/catalog.test.ts`
Expected: FAIL — `appendProductImages is not a function`

- [ ] **Step 3: Implement `appendProductImages` in `src/lib/catalog.ts`**

After `createProduct`, add:

```ts
type AppendProductImagesInput = {
  userId: string;
  productId: string;
  assetIds: string[];
};

export type AppendProductImagesResult = {
  product: Product;
  addedCount: number;
  skippedCount: number;
} | null;

export async function appendProductImages(
  input: AppendProductImagesInput,
): Promise<AppendProductImagesResult> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, input.productId), eq(productsTable.userId, input.userId)));
    if (!product) return null;

    const owned = await tx
      .select({ id: assetsTable.id })
      .from(assetsTable)
      .where(and(inArray(assetsTable.id, input.assetIds), eq(assetsTable.userId, input.userId)));
    const ownedSet = new Set(owned.map((r) => r.id));
    const validIds = input.assetIds.filter((id) => ownedSet.has(id));
    const totalRequested = input.assetIds.length;

    if (validIds.length === 0) {
      return { product: toProduct(product), addedCount: 0, skippedCount: totalRequested };
    }

    const existing = await tx
      .select({ assetId: productAssetsTable.assetId, maxPosition: productAssetsTable.position })
      .from(productAssetsTable)
      .where(eq(productAssetsTable.productId, input.productId));
    const existingSet = new Set(existing.map((r) => r.assetId));
    const newIds = validIds.filter((id) => !existingSet.has(id));
    const skippedCount = totalRequested - newIds.length;

    if (newIds.length === 0) {
      return { product: toProduct(product), addedCount: 0, skippedCount };
    }

    const startPos = existing.reduce((m, r) => Math.max(m, r.maxPosition), -1) + 1;
    await tx.insert(productAssetsTable).values(
      newIds.map((id, i) => ({
        productId: input.productId,
        assetId: id,
        role: 'reference' as const,
        position: startPos + i,
      })),
    );
    await tx
      .update(assetsTable)
      .set({ productId: input.productId, ownerType: 'product' })
      .where(inArray(assetsTable.id, newIds));

    return { product: toProduct(product), addedCount: newIds.length, skippedCount };
  });
}
```

(Confirm `and`, `eq`, `inArray` are already imported at the top of the file; they are used by `createProduct` so should be there.)

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm vitest run src/lib/catalog.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Write failing test for the HTTP route**

Create `src/app/api/catalog/products/[id]/images/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/userKey', () => ({ getUserKey: vi.fn() }));
vi.mock('@/lib/catalog', () => ({ appendProductImages: vi.fn() }));

import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { appendProductImages } from '@/lib/catalog';

function reqWith(body: unknown) {
  return new Request('http://t/p/123/images', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/catalog/products/[id]/images', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 when no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(reqWith({ assetIds: ['a'] }), { params: Promise.resolve({ id: 'p' }) });
    expect(res.status).toBe(401);
  });

  it('400 on invalid body', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    const res = await POST(reqWith({ assetIds: [] }), { params: Promise.resolve({ id: 'p' }) });
    expect(res.status).toBe(400);
  });

  it('404 when product not owned', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    vi.mocked(appendProductImages).mockResolvedValue(null);
    const res = await POST(reqWith({ assetIds: ['11111111-1111-1111-1111-111111111111'] }), {
      params: Promise.resolve({ id: 'p' }),
    });
    expect(res.status).toBe(404);
  });

  it('200 on success', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'x' } as never);
    vi.mocked(getUserKey).mockResolvedValue('u1');
    vi.mocked(appendProductImages).mockResolvedValue({
      product: { id: 'p', userId: 'u1' } as never,
      addedCount: 1,
      skippedCount: 0,
    });
    const res = await POST(reqWith({ assetIds: ['11111111-1111-1111-1111-111111111111'] }), {
      params: Promise.resolve({ id: 'p' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.addedCount).toBe(1);
  });
});
```

Run: `pnpm vitest run src/app/api/catalog/products/`
Expected: FAIL — route does not exist.

- [ ] **Step 6: Implement the route**

Create `src/app/api/catalog/products/[id]/images/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { appendProductImages } from '@/lib/catalog';
import { productImagesAppendSchema } from '@/lib/catalogSchema';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const parsed = productImagesAppendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const userKey = await getUserKey(session);
  const { id } = await params;
  const result = await appendProductImages({
    userId: userKey,
    productId: id,
    assetIds: parsed.data.assetIds,
  });
  if (!result) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 7: Confirm tests pass**

Run: `pnpm vitest run src/app/api/catalog/products/ src/lib/catalog.test.ts`
Expected: all pass.

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalogSchema.ts src/lib/catalog.ts src/lib/catalog.test.ts src/app/api/catalog/products/\[id\]/images/
git commit -m "feat(catalog): POST /products/[id]/images endpoint to append owned assets"
```

---

## Task 2: `ProductPickerDialog` component

**Files:**
- Create: `src/components/catalog/ProductPickerDialog.tsx`
- Create: `src/components/catalog/ProductPickerDialog.test.tsx`
- Modify: `src/components/catalog/index.ts` (add re-export)

- [ ] **Step 1: Write failing unit test**

Create `src/components/catalog/ProductPickerDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductPickerDialog } from './ProductPickerDialog';
import type { Product } from '@/lib/catalog';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

const products: Product[] = [
  { id: 'p1', userId: 'u', name: 'jacket', tags: [], status: 'live', usedInCount: 0, createdAt: 0 } as Product,
  { id: 'p2', userId: 'u', name: 'pants', tags: [], status: 'live', usedInCount: 0, createdAt: 0 } as Product,
];

describe('ProductPickerDialog', () => {
  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = vi.fn();
  });

  it('renders products and lets user pick one', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ product: { id: 'p1', name: 'jacket' }, addedCount: 2, skippedCount: 0 }),
    } as Response);
    const onSuccess = vi.fn();
    render(
      <ProductPickerDialog
        initialProducts={products}
        assetIds={['a1', 'a2']}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /jacket/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('p1', 2));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/catalog/products/p1/images',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('+ new product deep-links to catalog/new with images param', () => {
    render(
      <ProductPickerDialog
        initialProducts={products}
        assetIds={['a1', 'a2']}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /new product/i }));
    expect(mockPush).toHaveBeenCalledWith(
      '/brand/catalog/new?images=asset%3Aa1%2Casset%3Aa2',
    );
  });

  it('shows empty state when no products', () => {
    render(
      <ProductPickerDialog
        initialProducts={[]}
        assetIds={['a1']}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
  });
});
```

Run: `pnpm vitest run src/components/catalog/ProductPickerDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `ProductPickerDialog`**

Create `src/components/catalog/ProductPickerDialog.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { Product } from '@/lib/catalog';

type Props = {
  initialProducts: Product[];
  assetIds: string[];
  onClose: () => void;
  onSuccess: (productId: string, addedCount: number) => void;
};

export function ProductPickerDialog({ initialProducts, assetIds, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialProducts;
    return initialProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [initialProducts, query]);

  async function pickProduct(productId: string) {
    if (submitting) return;
    setSubmitting(productId);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/products/${productId}/images`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetIds }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        addedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `http ${res.status}`);
        setSubmitting(null);
        return;
      }
      onSuccess(productId, body.addedCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed');
      setSubmitting(null);
    }
  }

  function newProduct() {
    const qs = assetIds.map((id) => `asset:${id}`).join(',');
    router.push(`/brand/catalog/new?images=${encodeURIComponent(qs)}`);
  }

  const isEmpty = initialProducts.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal grid place-items-center bg-bg-0/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[640px] flex-col gap-4 rounded-[18px] border border-line bg-bg-1 p-6 shadow-[var(--shadow-xl)]">
        <header className="flex items-center justify-between gap-4">
          <div>
            <span className="t-eyebrow">// add to product</span>
            <h2 className="t-h3 text-fg-0">
              send {assetIds.length} image{assetIds.length === 1 ? '' : 's'} to&hellip;
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded-[6px] p-1 text-fg-2 hover:bg-bg-3 hover:text-fg-0"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[14px] text-fg-2">no products yet.</p>
            <Button variant="primary" onClick={newProduct}>
              <Plus size={14} strokeWidth={1.75} /> new product
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search products"
                className="pl-9"
              />
            </div>
            <ul className="grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={() => pickProduct(p.id)}
                    className="flex w-full items-center gap-3 rounded-[10px] border border-line bg-bg-2 p-3 text-left transition-colors hover:border-line-strong hover:bg-bg-3 disabled:opacity-50"
                  >
                    <div className="size-10 shrink-0 rounded-[6px] bg-bg-3" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-fg-0">{p.name}</p>
                      <p className="t-eyebrow text-fg-3">{p.status}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <footer className="flex items-center justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={newProduct}>
                <Plus size={14} strokeWidth={1.75} /> new product
              </Button>
              {error && <span className="text-[12px] text-danger">{error}</span>}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
```

(Verify `Button` accepts a `variant` prop. Check `src/components/ui/index.ts` for the exact prop API; if different, adapt the calls. The intent is "primary CTA button" and "ghost link-style button".)

- [ ] **Step 3: Re-export from `index.ts`**

Edit `src/components/catalog/index.ts`, append:

```ts
export { ProductPickerDialog } from './ProductPickerDialog';
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run src/components/catalog/ProductPickerDialog.test.tsx && pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/ProductPickerDialog.tsx src/components/catalog/ProductPickerDialog.test.tsx src/components/catalog/index.ts
git commit -m "feat(catalog): ProductPickerDialog modal — pick existing or new"
```

---

## Task 3: Per-tile menu on `CreativeCard` (photoshoot context)

**Files:**
- Modify: `src/components/campaigns/CreativeCard.tsx`
- Modify: `src/components/campaigns/CreativeCard.test.tsx`

- [ ] **Step 1: Read the existing component to understand the current API**

Run: open `src/components/campaigns/CreativeCard.tsx` and skim. Note current props, in particular `regenerate`, and how the existing test (`CreativeCard.test.tsx`) renders the component.

- [ ] **Step 2: Add failing tests for the new menu**

Append to `src/components/campaigns/CreativeCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { CreativeCard } from './CreativeCard';

describe('CreativeCard photoshoot menu', () => {
  it('shows kebab when context=photoshoot and tile is done', () => {
    render(
      <CreativeCard
        workflowId="wf1"
        presetId="li"
        initialStatus="done"
        quantity={1}
        context="photoshoot"
        tileAssetId="a1"
        regenerate={{ kind: 'photoshoot', id: 's1', tileId: 't1' }}
      />,
    );
    expect(screen.getByRole('button', { name: /tile actions/i })).toBeInTheDocument();
  });

  it('menu items are disabled while cooking', () => {
    render(
      <CreativeCard
        workflowId="wf1"
        presetId="li"
        initialStatus="cooking"
        quantity={1}
        context="photoshoot"
        tileAssetId={null}
        regenerate={{ kind: 'photoshoot', id: 's1', tileId: 't1' }}
      />,
    );
    const trigger = screen.queryByRole('button', { name: /tile actions/i });
    expect(trigger).toBeNull();
  });

  it('fires onUseAsProduct with the tile asset id', () => {
    const onUseAsProduct = vi.fn();
    render(
      <CreativeCard
        workflowId="wf1"
        presetId="li"
        initialStatus="done"
        quantity={1}
        context="photoshoot"
        tileAssetId="a1"
        onUseAsProduct={onUseAsProduct}
        regenerate={{ kind: 'photoshoot', id: 's1', tileId: 't1' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /tile actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /use as product image/i }));
    expect(onUseAsProduct).toHaveBeenCalledWith('a1');
  });
});
```

Run: `pnpm vitest run src/components/campaigns/CreativeCard.test.tsx`
Expected: FAIL — props not recognised, menu not rendered.

- [ ] **Step 3: Extend `CreativeCard` props and render the menu**

Add to the props type:

```ts
type CreativeCardProps = {
  // ...existing props
  context?: 'campaign' | 'photoshoot';
  tileAssetId?: string | null;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onUseAsProduct?: (assetId: string) => void;
  onUseInCampaign?: (assetId: string) => void;
};
```

Inside the component, after the existing thumbnail render, add:

```tsx
const showMenu =
  context === 'photoshoot' &&
  !selectMode &&
  status === 'done' &&
  tileAssetId != null;

{showMenu && (
  <TileMenu
    assetId={tileAssetId!}
    onUseAsProduct={onUseAsProduct}
    onUseInCampaign={onUseInCampaign}
    onRegenerate={onRegenerate}
  />
)}
{selectMode && (
  <button
    type="button"
    onClick={onToggleSelect}
    aria-pressed={selected}
    aria-label={selected ? 'deselect tile' : 'select tile'}
    className={cn(
      'absolute inset-0 z-card grid place-items-center rounded-[10px] transition-colors',
      selected ? 'bg-volt-soft ring-1 ring-volt' : 'bg-transparent hover:bg-bg-3/40',
    )}
  >
    {selected && <Check size={20} strokeWidth={2} className="text-volt" />}
  </button>
)}
```

Define `TileMenu` in the same file (or extract to `TileMenu.tsx` if it grows past ~80 lines):

```tsx
function TileMenu({
  assetId,
  onUseAsProduct,
  onUseInCampaign,
  onRegenerate,
}: {
  assetId: string;
  onUseAsProduct?: (assetId: string) => void;
  onUseInCampaign?: (assetId: string) => void;
  onRegenerate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-2 top-2 z-card">
      <button
        type="button"
        aria-label="tile actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-[6px] bg-bg-0/70 text-fg-0 backdrop-blur hover:bg-bg-2"
      >
        <MoreVertical size={14} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 flex w-[180px] flex-col rounded-[10px] border border-line bg-bg-1 p-1 shadow-[var(--shadow-lg)]"
        >
          {onUseAsProduct && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onUseAsProduct(assetId);
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 hover:bg-bg-3 hover:text-fg-0"
            >
              use as product image
            </button>
          )}
          {onUseInCampaign && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onUseInCampaign(assetId);
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 hover:bg-bg-3 hover:text-fg-0"
            >
              use in campaign
            </button>
          )}
          {onRegenerate && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onRegenerate();
              }}
              className="rounded-[6px] px-2 py-1.5 text-left text-[13px] text-fg-1 hover:bg-bg-3 hover:text-fg-0"
            >
              regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Add imports: `import { Check, MoreVertical } from 'lucide-react';`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run src/components/campaigns/CreativeCard.test.tsx && pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/CreativeCard.tsx src/components/campaigns/CreativeCard.test.tsx
git commit -m "feat(creative-card): per-tile menu + select mode (photoshoot context)"
```

---

## Task 4: `PhotoshootResults` select mode + bulk action bar

**Files:**
- Modify: `src/components/photoshoot/PhotoshootResults.tsx`
- Modify: `src/app/(app)/photoshoot/[id]/page.tsx` (RSC supplies initial products list)
- Modify: `src/components/photoshoot/index.ts`

- [ ] **Step 1: Update RSC page to load products for the picker dialog**

Edit `src/app/(app)/photoshoot/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { PhotoshootResults } from '@/components/photoshoot';
import { getPhotoshoot } from '@/lib/photoshoots';
import { listProducts } from '@/lib/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function PhotoshootDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const [shoot, products] = await Promise.all([
    getPhotoshoot(userKey, id),
    listProducts(userKey),
  ]);
  if (!shoot) notFound();
  return <PhotoshootResults shoot={shoot} products={products} />;
}
```

- [ ] **Step 2: Update `PhotoshootResults` to wire select mode, bulk bar, and dialog**

Replace the body of `PhotoshootResults.tsx` to add:

- New imports: `useState`, `useRouter` from `next/navigation`, `Sparkles` (already present), `ListChecks`, `X` icons. `ProductPickerDialog` from `@/components/catalog`. `Product` type from `@/lib/catalog`.
- New `products: Product[]` prop.
- A local `selecting: boolean` state and a `selectedTileIds: Set<string>` state.
- A `tileAssetById` map derived from `shoot.tiles`.
- Pass `context="photoshoot"`, `tileAssetId`, `selectMode`, `selected`, `onToggleSelect`, `onUseAsProduct`, `onUseInCampaign` to each `CreativeCard`.
- `onUseInCampaign(assetId)` → `router.push('/campaigns/new?refs=' + encodeURIComponent('asset:' + assetId))`.
- `onUseAsProduct(assetId)` → sets `dialogAssetIds = [assetId]`, opens dialog.
- Sticky bottom `BulkActionBar` rendered only when `selecting && selectedTileIds.size > 0`:
  ```tsx
  <div className="fixed inset-x-0 bottom-4 z-sticky mx-auto flex w-fit items-center gap-4 rounded-pill border border-line bg-bg-1/95 px-4 py-2 shadow-[var(--shadow-lg)] backdrop-blur">
    <span className="text-[13px] text-fg-1">
      {selectedTileIds.size} selected
    </span>
    <button onClick={clearSelection} className="t-eyebrow text-fg-3 hover:text-fg-0">clear</button>
    <span className="h-4 w-px bg-line" />
    <button
      type="button"
      disabled={readyAssetIds.length === 0}
      onClick={() => setDialogAssetIds(readyAssetIds)}
      className="rounded-[10px] bg-bg-3 px-3 py-1.5 text-[13px] text-fg-0 hover:bg-bg-4 disabled:opacity-50"
    >
      add to product ({readyAssetIds.length})
    </button>
    <button
      type="button"
      disabled={readyAssetIds.length === 0}
      onClick={startCampaignWith}
      className="rounded-[10px] bg-volt px-3 py-1.5 text-[13px] font-medium text-fg-on-volt hover:bg-volt-hover disabled:opacity-50"
    >
      start campaign ({readyAssetIds.length}) →
    </button>
  </div>
  ```
  where `readyAssetIds` is computed from `selectedTileIds` ∩ ready tiles, and `startCampaignWith` does:
  ```ts
  function startCampaignWith() {
    const qs = readyAssetIds.map((id) => `asset:${id}`).join(',');
    router.push(`/campaigns/new?refs=${encodeURIComponent(qs)}`);
  }
  ```
- `ProductPickerDialog` rendered when `dialogAssetIds.length > 0`, with `initialProducts={products}`, `assetIds={dialogAssetIds}`, `onClose={() => setDialogAssetIds([])}`, `onSuccess={(productId, n) => { setDialogAssetIds([]); clearSelection(); router.push('/brand/catalog/' + productId) }}`.

Full updated file (replace existing body, keep imports + types intact):

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ListChecks, Sparkles } from 'lucide-react';
import { BuzzPill } from '@/components/ui';
import { CreativeCard, SectionHead } from '@/components/campaigns';
import { ProductPickerDialog } from '@/components/catalog';
import { PHOTOSHOOT_TEMPLATES } from '@/lib/photoshootTemplates';
import type { Photoshoot } from '@/lib/photoshoots';
import type { Product } from '@/lib/catalog';

type Props = { shoot: Photoshoot; products: Product[] };

function ratioToPresetId(ratio: string): 'li' | 'ig-feed' | 'ig-story' | 'yt' {
  if (ratio === '1:1') return 'li';
  if (ratio === '4:5') return 'ig-feed';
  if (ratio === '9:16') return 'ig-story';
  return 'yt';
}

export function PhotoshootResults({ shoot, products }: Props) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);

  const presetId = ratioToPresetId(shoot.brief.ratio);
  const isCooking = shoot.tiles.some((t) => t.status === 'queued' || t.status === 'cooking');

  const tilesByTemplate = useMemo(() => {
    const map = new Map<string, typeof shoot.tiles>();
    for (const t of shoot.tiles) {
      const arr = map.get(t.templateId) ?? [];
      arr.push(t);
      map.set(t.templateId, arr);
    }
    return map;
  }, [shoot.tiles]);

  const tileAssetById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of shoot.tiles) {
      if (t.assetId) map.set(t.id, t.assetId);
    }
    return map;
  }, [shoot.tiles]);

  const readyAssetIds = useMemo(
    () =>
      Array.from(selectedTileIds)
        .map((tileId) => tileAssetById.get(tileId))
        .filter((id): id is string => typeof id === 'string'),
    [selectedTileIds, tileAssetById],
  );

  function toggleSelect(tileId: string) {
    setSelectedTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(tileId)) next.delete(tileId);
      else next.add(tileId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedTileIds(new Set());
  }

  function exitSelectMode() {
    setSelecting(false);
    clearSelection();
  }

  function useInCampaign(assetId: string) {
    router.push(`/campaigns/new?refs=${encodeURIComponent(`asset:${assetId}`)}`);
  }

  function startCampaignWith() {
    if (readyAssetIds.length === 0) return;
    const qs = readyAssetIds.map((id) => `asset:${id}`).join(',');
    router.push(`/campaigns/new?refs=${encodeURIComponent(qs)}`);
  }

  function handleProductSuccess(productId: string, addedCount: number) {
    setDialogAssetIds([]);
    exitSelectMode();
    router.push(`/brand/catalog/${productId}`);
    router.refresh();
    // eslint-disable-next-line no-console
    console.info(`added ${addedCount} image${addedCount === 1 ? '' : 's'} to product`);
  }

  return (
    <div className="relative">
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <Link
          href="/photoshoot"
          className="rounded-[6px] px-1.5 py-0.5 transition-colors duration-fast ease-out hover:bg-bg-2 hover:text-fg-1"
        >
          photoshoot
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} className="text-fg-3/60" />
        <span className="truncate px-1.5 py-0.5 text-fg-1">{shoot.title}</span>
      </nav>

      <header className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="t-eyebrow">
            // {shoot.brief.ratio} · {shoot.tiles.length} shots
          </span>
          <div className="flex items-center gap-3">
            <BuzzPill amount={shoot.estimatedBuzz} />
            {isCooking && (
              <span className="inline-flex items-center gap-[5px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt">
                <Sparkles size={12} strokeWidth={1.75} /> cooking
              </span>
            )}
            <button
              type="button"
              onClick={() => (selecting ? exitSelectMode() : setSelecting(true))}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-bg-2 px-2.5 py-1 text-[12px] text-fg-1 hover:border-line-strong hover:text-fg-0"
            >
              <ListChecks size={12} strokeWidth={1.75} />
              {selecting ? 'cancel' : 'select'}
            </button>
          </div>
        </div>
        <h1 className="t-h2 text-fg-0">{shoot.title}</h1>
        {shoot.brief.productNotes && (
          <p className="max-w-[680px] text-[14px] leading-[1.5] text-fg-2">
            {shoot.brief.productNotes}
          </p>
        )}
      </header>

      {Array.from(tilesByTemplate.entries()).map(([templateId, tiles]) => {
        const tpl = PHOTOSHOOT_TEMPLATES[templateId as keyof typeof PHOTOSHOOT_TEMPLATES];
        return (
          <section key={templateId} className="mt-10">
            <SectionHead
              title={tpl?.label ?? templateId}
              count={`${tiles.length} variant${tiles.length === 1 ? '' : 's'}`}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tiles.map((tile) => (
                <CreativeCard
                  key={tile.id}
                  workflowId={tile.workflowId}
                  presetId={presetId}
                  initialStatus={tile.status}
                  quantity={tile.quantity}
                  context="photoshoot"
                  tileAssetId={tile.assetId}
                  selectMode={selecting}
                  selected={selectedTileIds.has(tile.id)}
                  onToggleSelect={() => toggleSelect(tile.id)}
                  onUseAsProduct={(assetId) => setDialogAssetIds([assetId])}
                  onUseInCampaign={useInCampaign}
                  regenerate={{ kind: 'photoshoot', id: shoot.id, tileId: tile.id }}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selecting && selectedTileIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-sticky mx-auto flex w-fit items-center gap-4 rounded-pill border border-line bg-bg-1/95 px-4 py-2 shadow-[var(--shadow-lg)] backdrop-blur">
          <span className="text-[13px] text-fg-1">{selectedTileIds.size} selected</span>
          <button onClick={clearSelection} className="t-eyebrow text-fg-3 hover:text-fg-0">
            clear
          </button>
          <span className="h-4 w-px bg-line" />
          <button
            type="button"
            disabled={readyAssetIds.length === 0}
            onClick={() => setDialogAssetIds(readyAssetIds)}
            className="rounded-[10px] bg-bg-3 px-3 py-1.5 text-[13px] text-fg-0 hover:bg-bg-4 disabled:opacity-50"
          >
            add to product ({readyAssetIds.length})
          </button>
          <button
            type="button"
            disabled={readyAssetIds.length === 0}
            onClick={startCampaignWith}
            className="rounded-[10px] bg-volt px-3 py-1.5 text-[13px] font-medium text-fg-on-volt hover:bg-volt-hover disabled:opacity-50"
          >
            start campaign ({readyAssetIds.length}) →
          </button>
        </div>
      )}

      {dialogAssetIds.length > 0 && (
        <ProductPickerDialog
          initialProducts={products}
          assetIds={dialogAssetIds}
          onClose={() => setDialogAssetIds([])}
          onSuccess={handleProductSuccess}
        />
      )}
    </div>
  );
}
```

(Verify `Photoshoot['tiles'][number]` has `assetId: string | null`. If the type field is different — e.g. `linkedAssetId` — adjust accordingly. The schema column is `linked_asset_id` per `lib/db/schema.ts` photoshoot tiles; the public type is in `src/lib/photoshoots.ts` — read it before writing.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/photoshoot/PhotoshootResults.tsx src/app/\(app\)/photoshoot/\[id\]/page.tsx
git commit -m "feat(photoshoot): select mode + bulk action bar + product picker dialog"
```

---

## Task 5: `AddProductForm` library tab + `?images=` deep-link

**Files:**
- Modify: `src/components/catalog/AddProductForm.tsx`
- Modify: `src/app/(app)/brand/catalog/new/page.tsx`

- [ ] **Step 1: Update RSC page to pass deep-link IDs + assets list**

Edit `src/app/(app)/brand/catalog/new/page.tsx`:

```tsx
import { AddProductForm } from '@/components/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { listAssets } from '@/lib/assets';

export const metadata = { title: 'new product · vitrine' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseImageRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('asset:'))
    .map((id) => id.slice('asset:'.length))
    .slice(0, 8);
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const prefillIds = parseImageRefs(firstString(sp.images));

  let assets: Awaited<ReturnType<typeof listAssets>> = [];
  if (session) {
    const userKey = await getUserKey(session);
    assets = await listAssets(userKey);
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">brand DNA · new</span>
        <h1 className="t-h2 text-fg-0">add a product.</h1>
        <p className="text-[13.5px] text-fg-2">
          drop product photos — first one is the hero.
        </p>
      </header>

      <AddProductForm libraryAssets={assets} prefillAssetIds={prefillIds} />
    </div>
  );
}
```

- [ ] **Step 2: Extend `AddProductForm` with tab strip + library staged rows**

Add props:

```ts
type AddProductFormProps = {
  libraryAssets?: Asset[];
  prefillAssetIds?: string[];
};
```

Add state:

```ts
const [tab, setTab] = useState<'upload' | 'library'>('upload');
const [libraryPicked, setLibraryPicked] = useState<string[]>(prefillAssetIds ?? []);
```

Render the tab strip above the existing dropzone:

```tsx
<div role="tablist" className="inline-flex gap-1 rounded-[10px] border border-line bg-bg-2 p-1">
  <button
    role="tab"
    aria-selected={tab === 'upload'}
    onClick={() => setTab('upload')}
    className={cn('rounded-[6px] px-3 py-1.5 text-[13px]', tab === 'upload' ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1')}
  >
    upload
  </button>
  <button
    role="tab"
    aria-selected={tab === 'library'}
    onClick={() => setTab('library')}
    className={cn('rounded-[6px] px-3 py-1.5 text-[13px]', tab === 'library' ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1')}
  >
    pick from library
  </button>
</div>
```

When `tab === 'library'`, render `<AssetCatalogPicker value={libraryPicked.map(id => 'asset:' + id)} onChange={(ids) => setLibraryPicked(ids.filter(s => s.startsWith('asset:')).map(s => s.slice('asset:'.length)))} max={8} initialTab="assets" />`. (Adjust `max` to remaining cap = `8 - staged.length`.)

Render library-picked rows in the staged list with a "from library" badge instead of upload progress.

On submit, change the existing `imageAssetIds` calculation to:

```ts
const uploaded = await Promise.all(staged.map(uploadOne));
const validAssetIds = [
  ...uploaded.filter((id): id is string => typeof id === 'string'),
  ...libraryPicked,
];
// then existing POST /api/catalog/products with imageAssetIds: validAssetIds
```

- [ ] **Step 3: Manual smoke**

Run: `pnpm dev` in a separate shell (background). Visit `http://localhost:3000/brand/catalog/new?images=asset:<some-real-asset-uuid>` while logged in. Confirm the library tab shows the asset as pre-staged.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/AddProductForm.tsx src/app/\(app\)/brand/catalog/new/page.tsx
git commit -m "feat(catalog): AddProductForm library tab + ?images= deep-link"
```

---

## Task 6: `AssetUploader` library tab (promote existing asset)

**Files:**
- Modify: `src/components/assets/AssetUploader.tsx`
- Modify: `src/app/(app)/brand/assets/new/page.tsx`

- [ ] **Step 1: RSC supplies asset list**

Edit `src/app/(app)/brand/assets/new/page.tsx` to fetch `listAssets(userKey)` and pass as `libraryAssets` prop. Mirror the catalog page changes from Task 5.

- [ ] **Step 2: Add tab strip to `AssetUploader`**

Same UI pattern as Task 5. When library tab is active, render `AssetCatalogPicker` (assets-only). Selected asset(s) become "promote candidates" — distinct staged rows with a "promote to <collection>" affordance.

- [ ] **Step 3: Implement the promote action**

For each library-picked asset, on submit, call:

```ts
await fetch(`/api/assets/${assetId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ collection, brandId: currentBrandId ?? null }),
});
```

(Verify `PATCH /api/assets/[id]` accepts `brandId` and `collection`; if not, extend it in this task. The existing PATCH handler already accepts metadata fields per `AssetDetailView` usage. Read `src/app/api/assets/[id]/route.ts` first.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/assets/AssetUploader.tsx src/app/\(app\)/brand/assets/new/page.tsx
git commit -m "feat(assets): AssetUploader library tab — promote existing asset to brand collection"
```

---

## Task 7: `PhotoshootWizard` subject step + `?subject=` deep-link

**Files:**
- Modify: `src/components/photoshoot/PhotoshootWizard.tsx`
- Modify: `src/app/(app)/photoshoot/new/page.tsx`
- Modify: `src/lib/photoshoots.ts` (only if `referenceAssetIds` not already plumbed end-to-end — verify first)

- [ ] **Step 1: Inspect the wizard's existing brief shape**

Read `src/components/photoshoot/PhotoshootWizard.tsx` and `src/lib/photoshoots.ts`. Confirm that `referenceAssetIds` is already accepted by `createPhotoshoot` and is included in the workflow brief that ships to the orchestrator. If a gap is found (e.g., `referenceAssetIds` is stored but not injected into the prompt or as a reference image), file that as a sub-task before the UI change.

- [ ] **Step 2: RSC supplies prefill subject + library data**

Edit `src/app/(app)/photoshoot/new/page.tsx`:

```tsx
import { PhotoshootWizard } from '@/components/photoshoot/PhotoshootWizard';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getBuzzAccount } from '@/lib/civitai';
import { listAssets, getAsset } from '@/lib/assets';
import { listProducts, getProduct } from '@/lib/catalog';

export const metadata = { title: 'new photoshoot · vitrine' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NewPhotoshootPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const subjectRaw = firstString(sp.subject);

  let buzz = null;
  let assets: Awaited<ReturnType<typeof listAssets>> = [];
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let defaultSubject: { kind: 'asset' | 'product'; id: string } | null = null;

  if (session) {
    const userKey = await getUserKey(session);
    [buzz, assets, products] = await Promise.all([
      getBuzzAccount(session).catch(() => null),
      listAssets(userKey),
      listProducts(userKey),
    ]);

    if (subjectRaw) {
      const [kind, ...rest] = subjectRaw.split(':');
      const id = rest.join(':');
      if (kind === 'asset' && id) {
        const a = await getAsset(userKey, id);
        if (a) defaultSubject = { kind: 'asset', id };
      } else if (kind === 'product' && id) {
        const p = await getProduct(userKey, id);
        if (p) defaultSubject = { kind: 'product', id };
      }
    }
  }

  return (
    <PhotoshootWizard
      buzzBalance={buzz?.balance ?? null}
      libraryAssets={assets}
      libraryProducts={products}
      defaultSubject={defaultSubject}
    />
  );
}
```

(Adjust `getAsset` / `getProduct` to the real exports — `getProduct(userKey, id)` exists; verify `getAsset(userKey, id)` or use `assets.find(a => a.id === id)` against the list to avoid an extra query.)

- [ ] **Step 3: Extend wizard with subject sub-step**

Add props `libraryAssets`, `libraryProducts`, `defaultSubject`. Insert a subject step at the start of the brief with three options: `upload` (existing behavior, if any), `pick from library` (mounts `AssetCatalogPicker` with both tabs, max 1), `skip — describe in text` (no subject; only text brief).

When a subject is chosen, store `subject = { kind, id }` in wizard state and include the asset/product hero asset ID in `referenceAssetIds` on submit.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/photoshoot/PhotoshootWizard.tsx src/app/\(app\)/photoshoot/new/page.tsx
git commit -m "feat(photoshoot): subject sub-step + ?subject= deep-link prefill"
```

---

## Task 8: Cross-flow CTAs on asset + product detail

**Files:**
- Modify: `src/components/assets/AssetDetailView.tsx`
- Modify: `src/components/catalog/ProductDetail.tsx`

- [ ] **Step 1: Add "use as photoshoot subject" link to `AssetDetailView`**

In the actions section (next to the existing "use in a campaign" link, around line 128), append:

```tsx
<Link
  href={`/photoshoot/new?subject=${encodeURIComponent(`asset:${asset.id}`)}`}
  className="rounded-[8px] border border-line bg-bg-2 px-3 py-1.5 text-[13px] text-fg-1 hover:border-line-strong hover:text-fg-0"
>
  use as photoshoot subject
</Link>
```

- [ ] **Step 2: Add same link to `ProductDetail`**

Add in the actions row:

```tsx
<Link
  href={`/photoshoot/new?subject=${encodeURIComponent(`product:${product.id}`)}`}
  className="rounded-[8px] border border-line bg-bg-2 px-3 py-1.5 text-[13px] text-fg-1 hover:border-line-strong hover:text-fg-0"
>
  use as photoshoot subject
</Link>
```

And a `use in a campaign` link if not already present:

```tsx
<Link
  href={`/campaigns/new?refs=${encodeURIComponent(`product:${product.id}`)}`}
  className="rounded-[8px] border border-line bg-bg-2 px-3 py-1.5 text-[13px] text-fg-1 hover:border-line-strong hover:text-fg-0"
>
  use in a campaign
</Link>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/assets/AssetDetailView.tsx src/components/catalog/ProductDetail.tsx
git commit -m "feat(detail): use-as-photoshoot-subject + use-in-campaign CTAs"
```

---

## Task 9: E2E coverage

**Files:**
- Create: `tests/e2e/55-photoshoot-cross-flow.spec.ts`
- Create: `tests/e2e/35-catalog-picker.spec.ts`
- Create: `tests/e2e/65-photoshoot-subject.spec.ts`

For each spec, follow the established pattern in `tests/e2e/50-campaigns.spec.ts` and `tests/e2e/60-photoshoot.spec.ts`: log in via the `00-auth-flow` helper, seed any state through the API or DB helpers already in `tests/e2e/helpers/`, drive the UI, and assert both the on-screen result and the DB row (via existing DB helpers).

- [ ] **Step 1: Read the existing e2e helpers and one existing spec**

Skim `tests/e2e/50-campaigns.spec.ts`. Identify: auth helper import, DB helpers, the pattern for cooking a photoshoot (mocked by MSW).

- [ ] **Step 2: Write `55-photoshoot-cross-flow.spec.ts`**

Three test cases, written one at a time:

1. **per-tile use-in-campaign**: cook a photoshoot, open it, click kebab on a `done` tile → "use in campaign", assert URL is `/campaigns/new?refs=asset:<id>` and that the wizard shows the asset as a pre-staged reference.
2. **multi-select → existing product**: seed one product. From the photoshoot results, click "select", check two tiles, click "add to product (2)", pick the product. Assert the toast/navigation and a DB query showing 2 new `product_assets` rows for that product.
3. **multi-select → new product**: From the same starting point, click "+ new product" in the dialog. Assert URL is `/brand/catalog/new?images=asset:…` and that the form shows the pre-staged library rows.

Each test case = its own `test('…', async ({ page }) => {…})`. Commit after each one passes.

- [ ] **Step 3: Write `35-catalog-picker.spec.ts`**

Two test cases:

1. **upload + library mix**: from `/brand/catalog/new`, fill name, click `pick from library`, select an existing asset, switch to `upload`, drop a small fixture PNG, submit. Assert that the created product has two `product_assets` rows (one library, one uploaded).
2. **AssetUploader promote**: log in fresh user, seed one upload asset, visit `/brand/assets/new`, library tab, pick the asset, select collection `logos`, submit. Assert the row's `metadata.collection` (or `collection` column, whichever the schema uses) was patched and `brandId` is set; no new asset row was created.

- [ ] **Step 4: Write `65-photoshoot-subject.spec.ts`**

Two test cases:

1. From `/brand/assets/<id>`, click `use as photoshoot subject` → assert wizard URL contains `subject=asset:<id>` and the subject panel shows the asset.
2. From `/brand/catalog/<id>`, click `use as photoshoot subject` → assert wizard URL contains `subject=product:<id>` and the subject panel shows the product hero.

- [ ] **Step 5: Run the full E2E suite**

Run: `pnpm test:e2e -- 55-photoshoot-cross-flow 35-catalog-picker 65-photoshoot-subject`
Expected: pass. If any flakiness appears around MSW handlers, check `src/mocks/handlers.ts` for the orchestrator mocks that other photoshoot tests rely on — no new handlers should be needed.

- [ ] **Step 6: Commit (per-spec or rolled up)**

```bash
git add tests/e2e/55-photoshoot-cross-flow.spec.ts tests/e2e/35-catalog-picker.spec.ts tests/e2e/65-photoshoot-subject.spec.ts
git commit -m "test(e2e): cross-flow specs — photoshoot → product/campaign, picker tabs, subject prefill"
```

---

## Final verification

- [ ] **Step 1: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 2: Unit tests**

Run: `pnpm vitest run`
Expected: pass.

- [ ] **Step 3: E2E**

Run: `pnpm test:e2e`
Expected: pass.

- [ ] **Step 4: Manual demo run**

Run: `pnpm dev`, log in. Walk the full demo path:

- onboarding → upload one product photo (catalog/new, upload tab)
- photoshoot/new → subject = "pick from library" → pick the product → cook
- on results, select 2 tiles → "add to product" → pick the existing product → confirm `/brand/catalog/<id>` shows 3 images
- back to photoshoot results → click another tile's kebab → "use in campaign" → confirm wizard pre-staged the asset

Each transition should happen without a download or re-upload.

- [ ] **Step 5: PR**

```bash
gh pr create --title "feat: cross-flow UX — photoshoot/catalog/picker unblockers" --body "$(cat <<'EOF'
## Summary

- Photoshoot output is now routable to existing or new products and to campaign briefs without re-uploading.
- `AddProductForm` and `AssetUploader` accept a "pick from library" tab.
- Photoshoot wizard accepts a subject prefill from an existing asset or product, via UI and `?subject=` deep-link.

Spec: `docs/superpowers/specs/2026-06-08-cross-flow-ux-design.md`

## Test plan

- [ ] `pnpm typecheck`
- [ ] `pnpm vitest run`
- [ ] `pnpm test:e2e`
- [ ] Manual demo walk-through documented in the plan's final verification.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** every flow A–E in the spec maps to one or more tasks (A→Tasks 1+2+4, B→Tasks 1+2+4+5, C→Task 4, D→Tasks 7+8, E→Tasks 5+6).
- **Schema reality check:** spec mentioned "modify `POST /api/catalog/products` to accept `existingAssetIds`," but the route already accepts `imageAssetIds` per `productCreateSchema` and `createProduct`. Plan reuses the existing field; no schema change.
- **Subject reference plumbing:** Task 7 Step 1 calls out the verification step. If the orchestrator brief does not currently inject the `referenceAssetIds[0]`'s `publicUrl` as a reference image, that becomes a small additional sub-task inside Task 7 before the UI change.
- **No placeholder code:** every code block in the plan is the actual code or its real component skeleton, with the exception of two "verify the existing prop API" notes — those are pointers, not deferred work.
