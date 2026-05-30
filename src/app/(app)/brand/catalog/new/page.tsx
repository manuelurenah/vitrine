import { AddProductForm } from '@/components/catalog';

export const metadata = { title: 'new product · vitrine' };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-[640px]">
      <header className="mb-6">
        <span className="t-eyebrow">// new</span>
        <h1 className="mt-1 t-h2 text-fg-0">add a product.</h1>
        <p className="mt-1 text-[14px] text-fg-2">
          just name + notes for now. photos land when uploads hit r2.
        </p>
      </header>
      <AddProductForm />
    </div>
  );
}
