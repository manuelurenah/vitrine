'use client';

import { Check, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

type Props = {
  onPick: (hex: string) => void;
};

export function ColorPickerChip({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('#7c5cff');
  const [hexInput, setHexInput] = useState('#7c5cff');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setBoth(hex: string) {
    setDraft(hex);
    setHexInput(hex);
  }

  function commit() {
    const normalized = normalizeHex(draft);
    if (!normalized) return;
    onPick(normalized);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-[56px] w-[56px] items-center justify-center rounded-[10px] border border-dashed border-line bg-bg-3/60 text-fg-2 transition-colors duration-fast ease-out hover:border-line-volt hover:text-volt"
        title="pick a custom brand color"
      >
        <Plus size={16} strokeWidth={2} />
        <span className="sr-only">pick a custom brand color</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="pick a custom color"
          className="absolute left-0 top-[64px] z-overlay w-[228px] rounded-[14px] border border-line-volt bg-bg-2 p-3 shadow-bloom-volt-sm"
        >
          <HexColorPicker
            color={draft}
            onChange={(c) => setBoth(c.toLowerCase())}
            style={{ width: '100%', height: 160 }}
          />

          <div className="mt-3 flex items-center gap-2">
            <span
              aria-hidden
              className="h-7 w-7 shrink-0 rounded-pill"
              style={{
                background: draft,
                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
              }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const v = e.target.value;
                setHexInput(v);
                const n = normalizeHex(v);
                if (n) setDraft(n);
              }}
              onBlur={() => {
                const n = normalizeHex(hexInput);
                if (n) setHexInput(n);
                else setHexInput(draft);
              }}
              spellCheck={false}
              maxLength={7}
              className="w-full rounded-[8px] border border-line bg-bg-3 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-fg-0 focus:border-volt focus:outline-none"
              aria-label="hex value"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={!normalizeHex(hexInput)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-pill bg-volt font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-on-volt transition-colors duration-fast ease-out hover:bg-volt/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={12} strokeWidth={3} />
              add color
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-fg-3 transition-colors duration-fast ease-out hover:text-fg-0"
              aria-label="cancel"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function normalizeHex(input: string): string | null {
  const t = input.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^[0-9a-f]{6}$/.test(t)) return `#${t}`;
  if (/^#[0-9a-f]{3}$/.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  if (/^[0-9a-f]{3}$/.test(t)) return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  return null;
}
