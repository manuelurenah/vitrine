import { buildCampaignNewHref, buildPhotoshootNewHref } from '@/lib/campaignHref';
import type { CampaignSummary } from '@/lib/campaigns';
import type { Product } from '@/lib/catalog';
import { ProductDetailGallery } from './ProductDetailGallery';
import { ProductDetailHeader } from './ProductDetailHeader';
import { ProductMetaPanel } from './ProductMetaPanel';

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

        {/* Right column: inline-editable product metadata (client component) */}
        <ProductMetaPanel
          product={{
            id: product.id,
            name: product.name,
            notes: product.notes,
            tags: product.tags,
            status: product.status,
            usedInCount: product.usedInCount,
            createdAt: product.createdAt,
          }}
        />
      </section>
    </div>
  );
}
