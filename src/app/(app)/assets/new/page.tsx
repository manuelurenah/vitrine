import { redirect } from 'next/navigation';
import { AssetUploader } from '@/components/assets';
import { listAssets } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'upload assets · vitrine' };
export const dynamic = 'force-dynamic';

export default async function NewAssetPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  const libraryAssets = await listAssets(userKey);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">brand DNA · upload</span>
        <h1 className="t-h2 text-fg-0">add assets.</h1>
        <p className="text-[13.5px] text-fg-2">
          drop multiple files at once — we&apos;ll handle the rest.
        </p>
      </header>

      <AssetUploader redirectTo="/assets" libraryAssets={libraryAssets} />
    </div>
  );
}
