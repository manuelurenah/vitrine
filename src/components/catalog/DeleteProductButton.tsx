'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = { productId: string };

export function DeleteProductButton({ productId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm('delete this product? this is not reversible.')) return;
    setBusy(true);
    try {
      await fetch(`/api/catalog/products/${productId}`, { method: 'DELETE' });
      router.push('/brand/catalog');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={onDelete}
      disabled={busy}
      leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
    >
      {busy ? 'deleting…' : 'delete'}
    </Button>
  );
}
