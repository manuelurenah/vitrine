'use client';

import { UploadCloud, X } from 'lucide-react';
import { Spinner } from '@/components/ui';

export type LogoUploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string };

type Props = {
  src: string;
  name: string | null;
  caption: string;
  helperText: string;
  onReplace: (file: File) => void;
  onRemove?: () => void;
  status: LogoUploadStatus;
};

export function LogoPreview({
  src,
  name,
  caption,
  helperText,
  onReplace,
  onRemove,
  status,
}: Props) {
  const isUploading = status.kind === 'uploading';
  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-line-volt bg-bg-3/60 p-4">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ? `${name} logo` : 'brand logo'}
          className="h-[72px] w-[72px] rounded-[10px] border border-line-subtle bg-white object-contain p-1"
        />
        {isUploading && (
          <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-bg-0/70">
            <Spinner size={20} className="text-volt" label="uploading logo" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[12.5px] text-fg-1">
        <span className="truncate text-fg-0">{name ?? caption}</span>
        <span className="font-mono text-[10.5px] text-fg-3">{helperText}</span>
        <div className="mt-1 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-volt hover:text-fg-0">
            <UploadCloud size={11} strokeWidth={1.75} />
            replace
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                e.target.value = '';
              }}
            />
          </label>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3 hover:text-danger"
            >
              <X size={11} strokeWidth={2} />
              remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
