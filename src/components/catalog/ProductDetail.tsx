import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Badge, Chip } from '@/components/ui';
import { buildCampaignNewHref, buildPhotoshootNewHref } from '@/lib/campaignHref';
import type { CampaignSummary } from '@/lib/campaigns';
import type { Product } from '@/lib/catalog';
import { ProductDetailGallery } from './ProductDetailGallery';

export type ProductDetailImage = {
  id: string;
  publicUrl: string | null;
  name: string;
};

type Props = {
  product: Product;
  images?: ProductDetailImage[];
  campaigns?: CampaignSummary[];
};

export function ProductDetail({ product, images = [], campaigns = [] }: Props) {
  return (
    <div className="relative">
      <header className="flex items-center gap-3">
        <Link
          href="/catalog"
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
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[480px_1fr]">
        {/* Left column: interactive gallery (client component) */}
        <ProductDetailGallery
          productId={product.id}
          productName={product.name}
          images={images}
          campaigns={campaigns}
          editHref={`/catalog/${product.id}/edit`}
          photoshootHref={buildPhotoshootNewHref({ kind: 'product', id: product.id })}
          campaignHref={buildCampaignNewHref([{ kind: 'product', id: product.id }])}
        />

        {/* Right column: product info */}
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
