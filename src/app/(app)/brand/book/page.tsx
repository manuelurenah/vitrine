import { PlaceholderScreen } from '@/components/shell/PlaceholderScreen';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { listBrands } from '@/lib/brand';

export const metadata = { title: 'brand book · vitrine' };
export const dynamic = 'force-dynamic';

export default async function BrandBookPage() {
  const session = await getSession();
  if (!session) {
    return (
      <PlaceholderScreen
        eyebrow="brand book"
        title="your style guide."
        body="sign in to view your brand book."
      />
    );
  }

  const userKey = await getUserKey(session);
  const brands = await listBrands(userKey);

  if (brands.length === 0) {
    return (
      <PlaceholderScreen
        eyebrow="brand book"
        title="no brands yet."
        body="run onboarding once to seed your default brand profile."
      />
    );
  }

  const palette = brands.flatMap((b) => b.palette).slice(0, 8).join(' · ') || 'palette pending';
  return (
    <PlaceholderScreen
      eyebrow="brand book"
      title={`${brands.length} brand${brands.length === 1 ? '' : 's'}.`}
      body={`palette: ${palette}`}
    />
  );
}
