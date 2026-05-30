import { notFound } from 'next/navigation';
import { CampaignDetail } from '@/components/campaigns';
import { getCampaign } from '@/lib/campaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function CampaignDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;

  const campaign = await getCampaign(userKey, id);
  if (!campaign) notFound();

  return <CampaignDetail campaign={campaign} />;
}
