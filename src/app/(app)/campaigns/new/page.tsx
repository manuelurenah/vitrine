import { CampaignsList } from '@/components/campaigns';
import { BriefModalClient } from './BriefModalClient';

export const metadata = { title: 'new campaign · vitrine' };

export default function NewCampaignPage() {
  return (
    <>
      <CampaignsList />
      <BriefModalClient />
    </>
  );
}
