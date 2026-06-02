import { AddProductForm } from '@/components/catalog';

export const metadata = { title: 'new product · vitrine' };

export default function NewProductPage() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">brand DNA · new</span>
        <h1 className="t-h2 text-fg-0">add a product.</h1>
        <p className="text-[13.5px] text-fg-2">
          drop product photos — first one is the hero.
        </p>
      </header>

      <AddProductForm />
    </div>
  );
}
