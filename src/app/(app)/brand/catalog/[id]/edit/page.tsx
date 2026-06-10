import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditProductForm } from '@/components/catalog';
import { listAssetsForProduct } from '@/lib/assets';
import { getProduct } from '@/lib/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'edit product · vitrine' };

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const [product, attached] = await Promise.all([
    getProduct(userKey, id),
    listAssetsForProduct(id),
  ]);
  if (!product) notFound();

  const initialImages = attached.map((a) => ({
    id: a.id,
    publicUrl: a.publicUrl ?? null,
    name: a.storageKey.split('/').pop() ?? a.id,
  }));

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <Link
          href={`/brand/catalog/${product.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> back to product
        </Link>
        <span className="t-eyebrow">brand DNA · edit</span>
        <h1 className="t-h2 text-fg-0">edit {product.name}.</h1>
        <p className="text-[13.5px] text-fg-2">
          reorder, swap the hero, change details, or add new shots.
        </p>
      </header>

      <EditProductForm product={product} initialImages={initialImages} />
    </div>
  );
}
