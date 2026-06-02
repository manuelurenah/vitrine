import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge, Button, Chip } from '@/components/ui';
import { GradientThumb, type ThumbTone } from '@/components/campaigns';
import type { Product } from '@/lib/catalog';

const TONES: ThumbTone[] = ['volt', 'ion', 'ultraviolet', 'flux', 'buzz'];

type Props = { products: Product[] };

export function CatalogGrid({ products }: Props) {
  const hasItems = products.length > 0;
  return (
    <div className="relative">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="t-eyebrow">// catalog</span>
          <h1 className="mt-1 t-h2 text-fg-0">your products.</h1>
          <p className="mt-1 max-w-[520px] text-[14px] leading-[1.5] text-fg-2">
            every product becomes a chip in your brief, a source in your photoshoot.
          </p>
        </div>
        <Link href="/brand/catalog/new">
          <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
            new product
          </Button>
        </Link>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip active>all · {products.length}</Chip>
        <Chip>live · {products.filter((p) => p.status === 'live').length}</Chip>
        <Chip>draft · {products.filter((p) => p.status === 'draft').length}</Chip>
        <Chip>archived · {products.filter((p) => p.status === 'archived').length}</Chip>
      </div>

      {!hasItems ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line bg-bg-1 p-10 text-center">
          <div className="font-display text-[18px] font-semibold text-fg-0">
            no products yet.
          </div>
          <p className="max-w-[420px] text-[13.5px] text-fg-2">
            add your first product. notes feed every campaign prompt and photoshoot template.
          </p>
          <Link href="/brand/catalog/new">
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              new product
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p, i) => (
            <Link
              key={p.id}
              href={`/brand/catalog/${p.id}`}
              className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong"
            >
              <GradientThumb tone={TONES[i % TONES.length]} className="aspect-square" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-fg-0">{p.name}</span>
                  <Badge kind={p.status === 'live' ? 'live' : p.status === 'archived' ? 'archived' : 'draft'}>
                    {p.status}
                  </Badge>
                </div>
                <div className="font-mono text-[10.5px] text-fg-3">
                  {p.tags.length} tag{p.tags.length === 1 ? '' : 's'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
