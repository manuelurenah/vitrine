'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = { assetId: string; redirectTo?: string };

export function DeleteAssetButton({ assetId, redirectTo = '/brand/assets' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm('delete this asset? campaigns + products still reference it stay intact but lose the link.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `http ${res.status}`);
        setBusy(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="font-mono text-[11.5px] text-danger">{error}</span>}
      <Button
        variant="ghost"
        onClick={onDelete}
        disabled={busy}
        leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
      >
        {busy ? 'deleting…' : 'delete'}
      </Button>
    </div>
  );
}
