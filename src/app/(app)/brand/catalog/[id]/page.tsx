import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/catalog';
import { getProduct } from '@/lib/catalog';
import { listAssetsForProduct } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const [product, attached] = await Promise.all([
    getProduct(userKey, id),
    listAssetsForProduct(id),
  ]);
  if (!product) notFound();
  const images = attached
    .filter((a) => (a.contentType ?? '').startsWith('image/') || !a.contentType)
    .map((a) => ({ id: a.id, publicUrl: a.publicUrl ?? null, name: a.storageKey }));
  return <ProductDetail product={product} images={images} />;
}
