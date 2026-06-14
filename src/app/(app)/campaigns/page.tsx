import { CampaignsList } from '@/components/campaigns';
import { listCampaigns } from '@/lib/campaigns';
import { relativeDate } from '@/lib/relativeDate';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'campaigns · vitrine' };

const TONE_CYCLE = ['volt', 'flux', 'ultraviolet', 'ion', 'buzz'] as const;

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session) return <CampaignsList />;
  const userKey = await getUserKey(session);
  const campaigns = await listCampaigns(userKey);

  const past = campaigns.map((c, i) => {
    const live = c.tiles.filter((t) => t.status === 'done').length;
    const total = c.tiles.length;
    const done = total > 0 && live === total;
    return {
      id: c.id,
      name: c.title,
      date: relativeDate(c.createdAt),
      count: `${total} creatives${live > 0 && live < total ? ` · ${total - live} cooking` : ''}`,
      // Done campaigns show no badge; only surface the `cooking` state.
      status: done ? null : ('cooking' as const),
      tone: TONE_CYCLE[i % TONE_CYCLE.length]!,
      thumbUrl: c.thumbUrl,
    };
  });

  return <CampaignsList past={past} />;
}
