import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, FileText, Image as ImageIcon, Video } from 'lucide-react';
import { DeleteAssetButton } from '@/components/assets';
import { getAsset } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function AssetDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect('/');
  const userKey = await getUserKey(session);
  const { id } = await params;
  const asset = await getAsset(userKey, id);
  if (!asset) notFound();

  const isImage = asset.contentType?.startsWith('image/');
  const isVideo = asset.contentType?.startsWith('video/');
  const Icon = isVideo ? Video : isImage ? ImageIcon : FileText;
  const displayName = asset.storageKey.split('/').pop() ?? asset.id;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link
          href="/brand/assets"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> assets
        </Link>
        <span className="flex-1" />
        <DeleteAssetButton assetId={asset.id} />
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-bg-2">
          <div className="relative aspect-square w-full bg-bg-3">
            {isImage && asset.publicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.publicUrl}
                alt={displayName}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : isVideo && asset.publicUrl ? (
              <video
                src={asset.publicUrl}
                controls
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-fg-2">
                <Icon size={56} strokeWidth={1.25} />
              </span>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div>
            <span className="t-eyebrow">{'// '}{asset.kind}</span>
            <h1 className="mt-1 break-all t-h3 text-fg-0">{displayName}</h1>
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-y-2 rounded-[14px] border border-line-subtle bg-bg-2 p-4 font-mono text-[11.5px]">
            <dt className="text-fg-3">type</dt>
            <dd className="text-fg-1">{asset.contentType ?? '—'}</dd>
            <dt className="text-fg-3">size</dt>
            <dd className="text-fg-1">{formatBytes(asset.byteSize)}</dd>
            <dt className="text-fg-3">dimensions</dt>
            <dd className="text-fg-1">
              {asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}
            </dd>
            <dt className="text-fg-3">bucket</dt>
            <dd className="break-all text-fg-1">{asset.bucket}</dd>
            <dt className="text-fg-3">key</dt>
            <dd className="break-all text-fg-1">{asset.storageKey}</dd>
            {asset.workflowId && (
              <>
                <dt className="text-fg-3">workflow</dt>
                <dd className="break-all text-fg-1">{asset.workflowId}</dd>
              </>
            )}
            <dt className="text-fg-3">added</dt>
            <dd className="text-fg-1">{new Date(asset.createdAt).toLocaleString()}</dd>
          </dl>

          {asset.publicUrl && (
            <a
              href={asset.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-[10px] border border-line-subtle bg-bg-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-1 hover:bg-bg-3 hover:text-fg-0"
            >
              open original ↗
            </a>
          )}
        </aside>
      </section>
    </div>
  );
}
