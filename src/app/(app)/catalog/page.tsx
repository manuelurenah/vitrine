import { CatalogGrid } from '@/components/catalog';
import { listProducts } from '@/lib/catalog';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'catalog · vitrine' };
export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const session = await getSession();
  if (!session) return <CatalogGrid products={[]} />;
  const userKey = await getUserKey(session);
  const products = await listProducts(userKey);
  return <CatalogGrid products={products} />;
}
