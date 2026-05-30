'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, FieldLabel, Input, Textarea } from '@/components/ui';

export function AddProductForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          sku: sku.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          status: 'draft',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push('/brand/catalog');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="prod-name">product name</FieldLabel>
        <Input
          id="prod-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="lumen golden serum"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="prod-sku">sku</FieldLabel>
          <Input
            id="prod-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="LMN-001"
          />
        </div>
        <div>
          <FieldLabel htmlFor="prod-tags">tags</FieldLabel>
          <Input
            id="prod-tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="hero · serum · gift"
          />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="prod-notes">notes</FieldLabel>
        <Textarea
          id="prod-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="15ml amber dropper · turmeric + bakuchiol · warm honey palette"
        />
      </div>
      <div className="flex items-center justify-between pt-2">
        {error && <span className="font-mono text-[11.5px] text-danger">{error}</span>}
        <span className="flex-1" />
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || name.trim().length === 0}
          leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
        >
          {submitting ? 'saving…' : 'add to catalog'}
        </Button>
      </div>
    </form>
  );
}
