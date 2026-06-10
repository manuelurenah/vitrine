'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  maxWidth = 720,
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center px-6 py-10">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[6px]"
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[18px] border border-line bg-bg-1 shadow-xl',
          className,
        )}
        style={{ maxWidth }}
      >
        <header className="flex items-start gap-4 border-b border-line-subtle px-6 py-5">
          <div className="flex-1">
            {eyebrow && <span className="t-eyebrow">{eyebrow}</span>}
            {title && <h2 className="mt-1 t-h3 text-fg-0">{title}</h2>}
          </div>
          <IconButton
            variant="ghost"
            aria-label="close"
            icon={<X size={16} strokeWidth={1.75} />}
            onClick={onClose}
          />
        </header>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-line-subtle bg-bg-0/60 px-6 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}
