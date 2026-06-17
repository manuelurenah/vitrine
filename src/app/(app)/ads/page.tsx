import { AdCampaignsList } from '@/components/ads';
import { listAdCampaigns } from '@/lib/adCampaigns';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'ads · vitrine' };
export const dynamic = 'force-dynamic';

export default async function AdsPage() {
  const session = await getSession();
  if (!session) return <AdCampaignsList campaigns={[]} />;
  const userKey = await getUserKey(session);
  const campaigns = await listAdCampaigns(userKey);
  return <AdCampaignsList campaigns={campaigns} />;
}
