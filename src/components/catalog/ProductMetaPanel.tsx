'use client';

import { Pencil, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { Badge, Button, Chip, FieldLabel, Input, Select, Textarea } from '@/components/ui';
import type { ProductStatus } from '@/lib/catalog';

type MetaProduct = {
  id: string;
  name: string;
  notes?: string;
  tags: string[];
  status: ProductStatus;
  usedInCount: number;
  createdAt: number;
};

function badgeKindFor(status: ProductStatus) {
  return status === 'live' ? 'live' : status === 'archived' ? 'archived' : 'draft';
}

export function ProductMetaPanel({ product }: { product: MetaProduct }) {
  const router = useRouter();
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const statusId = useId();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.notes ?? '');
  const [tagsRaw, setTagsRaw] = useState(product.tags.join(', '));
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          tagsRaw
            .split(/[,\n]/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ).slice(0, 10),
    [tagsRaw],
  );

  function startEditing() {
    // reset working copy from props each time we enter edit mode
    setName(product.name);
    setDescription(product.notes ?? '');
    setTagsRaw(product.tags.join(', '));
    setStatus(product.status);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setName(product.name);
    setDescription(product.notes ?? '');
    setTagsRaw(product.tags.join(', '));
    setStatus(product.status);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/catalog/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        notes: description.trim() || undefined,
        tags,
        status,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError('save failed');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-[14px] border border-line-subtle bg-bg-2 p-4">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            product details
          </span>

          <div>
            <FieldLabel htmlFor={nameId}>product name</FieldLabel>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="lumen golden serum"
              required
            />
          </div>

          <div>
            <FieldLabel htmlFor={descriptionId}>
              description <span className="text-fg-3">· optional</span>
            </FieldLabel>
            <Textarea
              id={descriptionId}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="15ml amber dropper · turmeric + bakuchiol · warm honey palette"
            />
          </div>

          <div>
            <FieldLabel htmlFor={tagsId}>
              tags <span className="text-fg-3">· optional</span>
            </FieldLabel>
            <Input
              id={tagsId}
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="hero, serum, gift"
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            )}
          </div>

          <div>
            <FieldLabel htmlFor={statusId}>status</FieldLabel>
            <Select
              id={statusId}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
            >
              <option value="live">live</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line-subtle pt-4">
          <span className="font-mono text-[12px] text-fg-2">
            {error ? <span className="text-danger">· {error}</span> : null}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={cancel}
              disabled={saving}
              leadingIcon={<X size={14} strokeWidth={1.75} />}
            >
              cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={save}
              disabled={saving || name.trim().length === 0}
              leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            >
              {saving ? 'saving…' : 'save changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge kind={badgeKindFor(product.status)}>{product.status}</Badge>
          <h1 className="mt-2 t-h2 text-fg-0">{product.name}</h1>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 transition-colors duration-fast hover:bg-bg-3 hover:text-fg-0"
        >
          <Pencil size={13} strokeWidth={1.75} />
          edit
        </button>
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
  );
}
