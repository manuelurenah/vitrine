import { notFound } from 'next/navigation';
import { AdCampaignDetail } from '@/components/ads';
import { getAdCampaign } from '@/lib/adCampaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function AdCampaignPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) notFound();
  const userKey = await getUserKey(session);
  const { id } = await params;
  const campaign = await getAdCampaign(userKey, id);
  if (!campaign) notFound();
  return <AdCampaignDetail campaign={campaign} />;
}
