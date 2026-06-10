'use client';

import { ImageIcon, ShoppingBag, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import { Button, Chip, Modal } from '@/components/ui';

type Props = {
  placeholder?: string;
};

type PickerTab = 'products' | 'assets';

export function PromptComposer({ placeholder = 'describe the campaign you want to cook' }: Props) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);

  const canSubmit = value.trim().length > 0;

  const productCount = useMemo(() => refs.filter((id) => id.startsWith('product:')).length, [refs]);
  const assetCount = useMemo(() => refs.filter((id) => id.startsWith('asset:')).length, [refs]);

  function handleSubmit() {
    const prompt = value.trim();
    if (!prompt) return;
    const params = new URLSearchParams({ prompt });
    if (refs.length > 0) params.set('refs', refs.join(','));
    router.push(`/campaigns/new?${params.toString()}`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      <div
        className="relative rounded-[18px] border border-line-subtle bg-bg-2 p-4 shadow-md"
        style={{ boxShadow: 'var(--shadow-md), 0 0 0 1px var(--line-faint)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] opacity-60"
          style={{
            background:
              'linear-gradient(135deg, var(--volt-glow), transparent 40%, var(--ion-glow) 100%)',
            mask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />
        <div className="relative flex gap-3">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="min-h-[60px] flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-fg-0 outline-none placeholder:text-fg-3"
          />
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerTab('products')}
            aria-label="select products"
            className="appearance-none bg-transparent p-0"
          >
            <Chip
              leadingIcon={<ShoppingBag size={12} strokeWidth={1.75} />}
              active={productCount > 0}
            >
              product{productCount > 0 ? ` · ${productCount}` : ''}
            </Chip>
          </button>
          <button
            type="button"
            onClick={() => setPickerTab('assets')}
            aria-label="select reference images"
            className="appearance-none bg-transparent p-0"
          >
            <Chip leadingIcon={<ImageIcon size={12} strokeWidth={1.75} />} active={assetCount > 0}>
              images{assetCount > 0 ? ` · ${assetCount}` : ''}
            </Chip>
          </button>
          <span className="flex-1" />
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            generate brief
          </Button>
        </div>
      </div>

      <Modal
        open={pickerTab !== null}
        onClose={() => setPickerTab(null)}
        eyebrow="// pick references"
        title={pickerTab === 'assets' ? 'images' : 'products'}
        maxWidth={840}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-fg-2">
              {refs.length} selected · {productCount} product
              {productCount === 1 ? '' : 's'}, {assetCount} image
              {assetCount === 1 ? '' : 's'}
            </span>
            <Button type="button" variant="primary" onClick={() => setPickerTab(null)}>
              done
            </Button>
          </div>
        }
      >
        {pickerTab !== null && (
          <AssetCatalogPicker value={refs} onChange={setRefs} initialTab={pickerTab} />
        )}
      </Modal>
    </>
  );
}
