import { redirect } from 'next/navigation';
import { AssetsGallery } from '@/components/assets';
import { listLibraryAssets } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'assets · vitrine' };
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect('/');
  const userKey = await getUserKey(session);
  const assets = await listLibraryAssets(userKey, 200);

  return <AssetsGallery assets={assets} />;
}
