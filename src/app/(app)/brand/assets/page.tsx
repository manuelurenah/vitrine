import { redirect } from 'next/navigation';
import { AssetsGallery } from '@/components/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { listAssets } from '@/lib/assets';

export const metadata = { title: 'assets · vitrine' };
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect('/');
  const userKey = await getUserKey(session);
  const assets = await listAssets(userKey, 200);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">brand DNA · assets</span>
        <h1 className="t-h2 text-fg-0">your asset library.</h1>
        <p className="max-w-[640px] text-[14px] text-fg-2">
          logos, past campaigns, partner marks, references — anything that isn&apos;t a product.
          campaigns + shoots can pull from here.
        </p>
      </header>

      <AssetsGallery assets={assets} />
    </div>
  );
}
