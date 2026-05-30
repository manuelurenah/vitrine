import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/catalog';
import { getProduct } from '@/lib/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const product = await getProduct(userKey, id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
