import { notFound, redirect } from 'next/navigation';
import { AssetDetailView } from '@/components/assets/AssetDetailView';
import { type Asset, getAsset, listAssets } from '@/lib/assets';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / (1024 * 1024)).toFixed(2)} mb`;
}

function relativeUploaded(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatLabel(asset: Asset): string {
  const ext = asset.contentType?.split('/')[1] ?? 'file';
  const size = formatBytes(asset.byteSize);
  return size === '—' ? ext : `${ext} · ${size}`;
}

function dimensionsLabel(asset: Asset): string {
  if (asset.width && asset.height) return `${asset.width} × ${asset.height}`;
  return '—';
}

function collectionLabel(asset: Asset): string {
  const fromMeta = asset.metadata.collection;
  if (typeof fromMeta === 'string' && fromMeta.length > 0) return fromMeta;
  return asset.kind;
}

function displayNameOf(asset: Asset): string {
  return asset.storageKey.split('/').pop() ?? asset.id;
}

export default async function AssetDetailPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect('/');
  const userKey = await getUserKey(session);
  const { id } = await params;

  const [asset, siblings] = await Promise.all([getAsset(userKey, id), listAssets(userKey)]);
  if (!asset) notFound();

  const idx = siblings.findIndex((s) => s.id === asset.id);
  const prevId = idx > 0 ? siblings[idx - 1]!.id : null;
  const nextId = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1]!.id : null;

  const strip = siblings.slice(0, 24).map((s) => ({
    id: s.id,
    publicUrl: s.publicUrl,
    contentType: s.contentType,
  }));

  return (
    <AssetDetailView
      asset={asset}
      prevId={prevId}
      nextId={nextId}
      strip={strip}
      displayName={displayNameOf(asset)}
      collectionLabel={collectionLabel(asset)}
      uploadedLabel={relativeUploaded(asset.createdAt)}
      formatLabel={formatLabel(asset)}
      dimensionsLabel={dimensionsLabel(asset)}
    />
  );
}
