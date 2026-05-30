import Link from 'next/link';
import { FileText, Image as ImageIcon, Upload, Video } from 'lucide-react';
import { cn } from '@/components/ui';
import type { Asset } from '@/lib/assets';

export function AssetsGallery({ assets }: { assets: Asset[] }) {
  if (assets.length === 0) return <EmptyState />;

  const sections: Array<{ key: string; title: string; items: Asset[] }> = [];
  const byCollection = new Map<string, Asset[]>();
  for (const a of assets) {
    const collection =
      (a as Asset & { metadata?: { collection?: string } }).metadata?.collection ?? a.kind;
    const bucket = byCollection.get(collection) ?? [];
    bucket.push(a);
    byCollection.set(collection, bucket);
  }
  for (const [k, v] of byCollection) sections.push({ key: k, title: k, items: v });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
          {assets.length} total
        </span>
        {sections.map((s) => (
          <span
            key={s.key}
            className="rounded-pill border border-line-subtle px-2.5 py-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-2"
          >
            {s.title} · {s.items.length}
          </span>
        ))}
        <span className="flex-1" />
        <Link
          href="/brand/assets/new"
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-volt bg-volt-soft px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
        >
          <Upload size={13} strokeWidth={1.75} /> upload
        </Link>
      </div>

      {sections.map((s) => (
        <section key={s.key} className="flex flex-col gap-3">
          <header className="flex items-baseline gap-2">
            <h3 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-fg-0">
              {s.title}
            </h3>
            <span className="font-mono text-[11px] text-fg-3">· {s.items.length}</span>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {s.items.map((item) => (
              <AssetTile key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AssetTile({ item }: { item: Asset }) {
  const isImage = item.contentType?.startsWith('image/');
  const isVideo = item.contentType?.startsWith('video/');
  const Icon = isVideo ? Video : isImage ? ImageIcon : FileText;
  const displayName = item.storageKey.split('/').pop() ?? item.id;

  return (
    <article
      className={cn(
        'group relative flex aspect-square flex-col overflow-hidden rounded-[12px] border border-line-subtle bg-bg-2',
        'transition-colors duration-fast ease-out hover:border-line',
      )}
    >
      <div className="relative flex-1 overflow-hidden bg-bg-3">
        {isImage && item.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.publicUrl}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-fg-2">
            <Icon size={26} strokeWidth={1.5} />
          </span>
        )}
      </div>
      <div className="border-t border-line-subtle bg-bg-2 px-2.5 py-2">
        <div className="truncate text-[12px] text-fg-0">{displayName}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">
          {item.kind} · {item.contentType?.split('/')[1] ?? 'file'}
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[14px] border border-dashed border-line bg-bg-2/60 px-6 py-14 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-[14px] border border-line-volt"
        style={{ background: 'rgba(0,255,157,0.18)' }}
      >
        <Upload size={26} strokeWidth={1.5} />
      </span>
      <div>
        <h2 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-fg-0">
          upload your first <span className="text-volt">asset</span>.
        </h2>
        <p className="mt-1 max-w-[460px] text-[13.5px] text-fg-2">
          drop a file, or pick a collection to start. assets are loose — name + tags are all we need.
        </p>
      </div>
      <Link
        href="/brand/assets/new"
        className="inline-flex items-center gap-2 rounded-[10px] border border-line-volt bg-volt-soft px-4 py-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
      >
        <Upload size={14} strokeWidth={1.75} /> choose files
      </Link>
    </div>
  );
}
