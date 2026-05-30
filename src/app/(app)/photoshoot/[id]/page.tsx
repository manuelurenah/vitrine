import { notFound } from 'next/navigation';
import { PhotoshootResults } from '@/components/photoshoot';
import { getPhotoshoot } from '@/lib/photoshoots';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function PhotoshootDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const shoot = await getPhotoshoot(userKey, id);
  if (!shoot) notFound();
  return <PhotoshootResults shoot={shoot} />;
}
