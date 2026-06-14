'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Mobile bottom-sheet primitive.
 * Slides up from the bottom with a blurred scrim behind it.
 * Shares the same prop shape as Modal (minus maxWidth).
 * Renders nothing when not mounted.
 */
export function BottomSheet({ open, onClose, title, eyebrow, children, footer, className }: Props) {
  // render keeps the DOM around during the exit animation; initialized to `open`
  // so an initially-open sheet is present on the very first render (SSR-safe).
  const [render, setRender] = useState(open);
  // enter drives the CSS classes for open/closed transition states; initialized
  // to `open` so an already-open sheet renders in its entered state.
  const [enter, setEnter] = useState(open);

  // Mount/enter/exit are driven entirely from an effect (not via setState during
  // render). The render-time approach is not safe under React 19 StrictMode's
  // double-invoked render in dev: the sheet would mount invisibly then immediately
  // unmount, so the trigger looked like a no-op. The one extra render this costs on
  // open is negligible for a sheet.
  useEffect(() => {
    if (open) {
      setRender(true);
      // Defer enter so the opening transition is seen (browser needs one frame)
      const raf = requestAnimationFrame(() => setEnter(true));
      return () => cancelAnimationFrame(raf);
    }
    // Begin the exit immediately, then unmount after the transition (>160ms)
    setEnter(false);
    const t = setTimeout(() => setRender(false), 180);
    return () => clearTimeout(t);
  }, [open]);

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

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-modal flex flex-col justify-end">
      {/* Scrim */}
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className={cn(
          'absolute inset-0 cursor-default bg-black/55 backdrop-blur-[6px]',
          'transition-opacity duration-[160ms] ease-out',
          enter ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Sheet panel */}
      <div
        role="dialog"
        aria-modal
        data-testid="bottom-sheet"
        data-state={enter ? 'open' : 'closed'}
        className={cn(
          'relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[18px] border border-line bg-bg-1 shadow-xl',
          'transition-transform duration-[160ms] ease-out',
          enter ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-9 rounded-pill bg-line" />
        </div>

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
