'use client';

import { ChevronDown, ImageIcon, Mic, ShoppingBag, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button, Chip } from '@/components/ui';

type Props = {
  placeholder?: string;
  briefCostBuzz?: number;
};

export function PromptComposer({
  placeholder = 'describe the campaign you want to cook',
  briefCostBuzz = 8,
}: Props) {
  const [value, setValue] = useState('');
  const canSubmit = value.trim().length > 0;

  return (
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
          placeholder={placeholder}
          rows={2}
          className="min-h-[60px] flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-fg-0 outline-none placeholder:text-fg-3"
        />
        <button
          type="button"
          aria-label="voice input"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line-subtle bg-bg-3 text-fg-1 transition-colors duration-fast ease-out hover:text-fg-0"
        >
          <Mic size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <Chip leadingIcon={<ShoppingBag size={12} strokeWidth={1.75} />}>product</Chip>
        <Chip leadingIcon={<ImageIcon size={12} strokeWidth={1.75} />}>images</Chip>
        <Chip>
          aspect ratio
          <ChevronDown size={11} strokeWidth={2} />
        </Chip>
        <span className="flex-1" />
        <Button
          variant="primary"
          disabled={!canSubmit}
          leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
        >
          generate brief
          <span className="ml-1 font-mono text-[11px] opacity-70">· {briefCostBuzz} buzz</span>
        </Button>
      </div>
    </div>
  );
}
