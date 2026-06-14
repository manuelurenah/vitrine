import { Badge, Chip } from '@/components/ui';
import { buildCampaignNewHref, buildPhotoshootNewHref } from '@/lib/campaignHref';
import type { CampaignSummary } from '@/lib/campaigns';
import type { Product } from '@/lib/catalog';
import { ProductDetailGallery } from './ProductDetailGallery';
import { ProductDetailHeader } from './ProductDetailHeader';

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
  const badgeKind =
    product.status === 'live' ? 'live' : product.status === 'archived' ? 'archived' : 'draft';

  return (
    <div className="relative">
      <ProductDetailHeader
        productId={product.id}
        campaignHref={buildCampaignNewHref([{ kind: 'product', id: product.id }])}
        photoshootHref={buildPhotoshootNewHref({ kind: 'product', id: product.id })}
      />

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[480px_1fr]">
        {/* Left column: interactive gallery (client component) */}
        <ProductDetailGallery
          productId={product.id}
          productName={product.name}
          images={images}
          campaigns={campaigns}
        />

        {/* Right column: product info */}
        <div className="flex flex-col gap-4">
          <div>
            <Badge kind={badgeKind}>{product.status}</Badge>
            <h1 className="mt-2 t-h2 text-fg-0">{product.name}</h1>
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
