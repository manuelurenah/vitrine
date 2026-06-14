import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AssetUploader } from '@/components/assets';
import { getSession } from '@/lib/session';

export const metadata = { title: 'upload assets · vitrine' };
export const dynamic = 'force-dynamic';

export default async function NewAssetPage() {
  const session = await getSession();
  if (!session) redirect('/');

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 self-start"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> assets
        </Link>
        <h1 className="t-h2 text-fg-0">add assets.</h1>
        <p className="text-[13.5px] text-fg-2">
          drop multiple files at once — we&apos;ll handle the rest.
        </p>
      </header>

      <AssetUploader redirectTo="/assets" />
    </div>
  );
}
