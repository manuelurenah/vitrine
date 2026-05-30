import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge, Chip } from '@/components/ui';
import { GradientThumb } from '@/components/campaigns';
import { DeleteProductButton } from './DeleteProductButton';
import type { Product } from '@/lib/catalog';

type Props = { product: Product };

export function ProductDetail({ product }: Props) {
  return (
    <div className="relative">
      <header className="flex items-center gap-3">
        <Link
          href="/brand/catalog"
          className="inline-flex items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] py-[7px] text-[13px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> catalog
        </Link>
        <Badge kind={product.status === 'live' ? 'live' : product.status === 'archived' ? 'archived' : 'draft'}>
          {product.status}
        </Badge>
        <span className="flex-1" />
        <DeleteProductButton productId={product.id} />
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[440px_1fr]">
        <GradientThumb tone="volt" className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <div>
            <span className="t-eyebrow">// {product.sku || 'sku not set'}</span>
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
              <span className="t-eyebrow">// notes</span>
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
