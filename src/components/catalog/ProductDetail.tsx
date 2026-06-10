import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { GradientThumb } from '@/components/campaigns';
import { Badge, Chip } from '@/components/ui';
import { buildCampaignNewHref, buildPhotoshootNewHref } from '@/lib/campaignHref';
import type { Product } from '@/lib/catalog';
import { DeleteProductButton } from './DeleteProductButton';

export type ProductDetailImage = {
  id: string;
  publicUrl: string | null;
  name: string;
};

type Props = {
  product: Product;
  images?: ProductDetailImage[];
};

export function ProductDetail({ product, images = [] }: Props) {
  const hero = images[0];
  const rest = images.slice(1);

  return (
    <div className="relative">
      <header className="flex items-center gap-3">
        <Link
          href="/brand/catalog"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> catalog
        </Link>
        <Badge
          kind={
            product.status === 'live'
              ? 'live'
              : product.status === 'archived'
                ? 'archived'
                : 'draft'
          }
        >
          {product.status}
        </Badge>
        <span className="flex-1" />
        <Link
          href={buildCampaignNewHref([{ kind: 'product', id: product.id }])}
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          use in a campaign
        </Link>
        <Link
          href={buildPhotoshootNewHref({ kind: 'product', id: product.id })}
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          use as photoshoot subject
        </Link>
        <Link
          href={`/brand/catalog/${product.id}/edit`}
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <Pencil size={13} strokeWidth={1.75} /> edit
        </Link>
        <DeleteProductButton productId={product.id} />
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[440px_1fr]">
        <div className="flex flex-col gap-2">
          {hero && hero.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.publicUrl}
              alt={product.name}
              className="aspect-square w-full rounded-[14px] border border-line-subtle object-cover"
            />
          ) : (
            <GradientThumb tone="volt" className="aspect-square w-full" />
          )}
          {rest.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {rest.map((img) =>
                img.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={img.publicUrl}
                    alt={img.name}
                    className="aspect-square w-full rounded-md border border-line-subtle object-cover"
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <span className="t-eyebrow">// product</span>
            <h1 className="mt-1 t-h2 text-fg-0">{product.name}</h1>
          </div>
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <Chip key={t} ghost>
                  {t}
                </Chip>
              ))}
            </div>
          )}
          {product.notes && (
            <div className="rounded-[14px] border border-line-subtle bg-bg-2 p-4">
              <span className="t-eyebrow">// description</span>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.5] text-fg-1">
                {product.notes}
              </p>
            </div>
          )}
          <div className="rounded-[14px] border border-line-subtle bg-bg-2 p-4 font-mono text-[11.5px] text-fg-2">
            used in {product.usedInCount} campaign{product.usedInCount === 1 ? '' : 's'} · added{' '}
            {new Date(product.createdAt).toLocaleString()}
          </div>
        </div>
      </section>
    </div>
  );
}
