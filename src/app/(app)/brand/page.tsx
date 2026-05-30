import { PlaceholderScreen } from '@/components/shell/PlaceholderScreen';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { ensureDefaultBrand } from '@/lib/brand';

export const metadata = { title: 'brand dna · vitrine' };
export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  const session = await getSession();
  if (!session) {
    return (
      <PlaceholderScreen
        eyebrow="your brand dna"
        title="brand overview."
        body="sign in to see your brand dna."
      />
    );
  }

  const userKey = await getUserKey(session);
  const brand = await ensureDefaultBrand(userKey);

  const paletteSummary = brand.palette.length
    ? brand.palette.slice(0, 4).join(' · ')
    : 'palette not extracted yet';

  return (
    <PlaceholderScreen
      eyebrow="your brand dna"
      title={brand.name}
      body={[
        brand.description ?? 'no description yet — finish onboarding to populate.',
        `palette: ${paletteSummary}`,
        brand.tone ? `tone: ${brand.tone}` : 'tone: tbd',
        brand.industry ? `industry: ${brand.industry}` : null,
        brand.audience ? `audience: ${brand.audience}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    />
  );
}
