import { redirect } from 'next/navigation';
import { BrandEditor } from '@/components/brand';
import { ensureDefaultBrand } from '@/lib/brand';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'brand dna · vitrine' };
export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  const brand = await ensureDefaultBrand(userKey);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">{'// '}brand dna</span>
        <h1 className="t-h2 text-fg-0">{brand.name}.</h1>
        <p className="text-[13.5px] text-fg-2">
          tone + palette feeds every campaign + photoshoot prompt. edit anytime.
        </p>
      </header>
      <BrandEditor brand={brand} />
    </div>
  );
}
