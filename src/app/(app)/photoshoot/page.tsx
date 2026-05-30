import { PhotoshootList } from '@/components/photoshoot';
import { listPhotoshoots } from '@/lib/photoshoots';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'photoshoot · vitrine' };
export const dynamic = 'force-dynamic';

export default async function PhotoshootPage() {
  const session = await getSession();
  if (!session) return <PhotoshootList shoots={[]} />;
  const userKey = await getUserKey(session);
  const shoots = await listPhotoshoots(userKey);
  return <PhotoshootList shoots={shoots} />;
}
