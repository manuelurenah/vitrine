'use client';

import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';
import { Wordmark } from './Wordmark';

type Props = {
  /** Center title text. If omitted, the center column is empty. */
  title?: string;
  /** Optional eyebrow above the title (mono uppercase). */
  eyebrow?: string;
  /**
   * Show a back button in the leading slot.
   * Pass an href for Link navigation, or omit for a plain button (caller
   * should wire onClick via the rightSlot or a wrapper).
   */
  back?: { href: string; label?: string } | true;
  /** Show the wordmark in the leading slot (ignored when back is set). */
  leadingLogo?: boolean;
  /** Content placed in the trailing action slot (e.g. BuzzPill, IconButton). */
  rightSlot?: ReactNode;
  /** Make the bar background transparent (for hero/immersive screens). */
  transparent?: boolean;
  className?: string;
};

/**
 * 52 px sticky top bar for mobile screens.
 *
 * Grid: [36px leading] [1fr center] [auto trailing]
 * Background: rgba(15,15,22,0.92) + backdrop-blur(14px).
 * Matches mobile-shell.jsx / vitrine-mobile.css `.m-topbar`.
 */
export function MobileTopBar({
  title,
  eyebrow,
  back,
  leadingLogo,
  rightSlot,
  transparent = false,
  className,
}: Props) {
  const backHref = back && back !== true ? back.href : undefined;

  return (
    <header
      className={cn(
        'sticky top-0 z-10 grid h-[52px] grid-cols-[36px_1fr_auto] items-center gap-2 px-2',
        'border-b',
        transparent
          ? 'border-transparent bg-transparent'
          : 'border-line-subtle backdrop-blur-[14px]',
        className,
      )}
      style={transparent ? undefined : { background: 'rgba(15,15,22,0.92)' }}
    >
      {/* Leading slot — back button or wordmark */}
      {back ? (
        backHref ? (
          <a
            href={backHref}
            aria-label={typeof back === 'object' && back.label ? back.label : 'back'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line-subtle bg-bg-2 text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </a>
        ) : (
          <button
            type="button"
            aria-label={typeof back === 'object' && back.label ? back.label : 'back'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line-subtle bg-bg-2 text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </button>
        )
      ) : leadingLogo ? (
        <span className="pl-[6px]">
          <Wordmark />
        </span>
      ) : (
        <span className="w-9" aria-hidden="true" />
      )}

      {/* Center slot — eyebrow + title */}
      <div className="flex flex-col items-center leading-none">
        {eyebrow && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-3">
            {eyebrow}
          </span>
        )}
        {title && (
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-fg-0">
            {title}
          </span>
        )}
      </div>

      {/* Trailing slot */}
      <div className="flex items-center gap-[6px] pr-1">
        {rightSlot ?? <span className="w-9" aria-hidden="true" />}
      </div>
    </header>
  );
}
