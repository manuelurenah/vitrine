'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui';

type PanelRowProps = {
  label: string;
  /** Whether the row starts open. Defaults to false. */
  defaultOpen?: boolean;
  /** If provided, the row is controlled from outside. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  /** If provided, sets data-testid on the header button. */
  testId?: string;
};

export function PanelRow({
  label,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  testId,
}: PanelRowProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function toggle() {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setInternalOpen((v) => !v);
    }
  }

  return (
    <div className="rounded-[10px] border border-line-subtle bg-bg-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        data-testid={testId}
        className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-fast ease-out hover:bg-bg-3"
      >
        <ChevronRight
          size={11}
          strokeWidth={1.75}
          className={cn(
            'shrink-0 text-fg-3 transition-transform duration-150',
            isOpen && 'rotate-90',
          )}
        />
        <span className="flex-1 text-[13px] font-medium text-fg-1">{label}</span>
      </button>
      {isOpen && children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
