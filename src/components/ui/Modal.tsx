'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { useMediaQuery } from './useMediaQuery';

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
  const isMobile = useMediaQuery('(max-width: 767px)');

  // mounted keeps the DOM around during the exit animation
  const [mounted, setMounted] = useState(false);
  // visible drives the CSS classes for open/closed states
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Defer visible so the opening transition is seen (browser needs one frame)
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    // Start exit: remove visible, then unmount after transition (~160ms)
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 160);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || isMobile) return;
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
  }, [open, onClose, isMobile]);

  // On mobile, delegate to BottomSheet
  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        eyebrow={eyebrow}
        footer={footer}
        className={className}
      >
        {children}
      </BottomSheet>
    );
  }

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center px-6 py-10">
      {/* Scrim */}
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className={cn(
          'absolute inset-0 cursor-default bg-black/55 backdrop-blur-[6px]',
          'transition-opacity duration-[160ms] ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal
        data-state={visible ? 'open' : 'closed'}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[18px] border border-line bg-bg-1 shadow-xl',
          'transition-[opacity,transform] duration-[160ms] ease-out',
          visible ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0',
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
