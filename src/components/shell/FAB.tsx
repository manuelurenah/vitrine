import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

type BaseProps = {
  /** Optional text label rendered beside the icon. */
  label?: string;
  /** Override the icon. Defaults to a `Plus` icon. */
  icon?: ReactNode;
  /** Accessible label for screen readers (required when no visible label). */
  'aria-label'?: string;
  className?: string;
};

type LinkProps = BaseProps & {
  href: string;
  onClick?: never;
};

type ButtonProps = BaseProps & {
  href?: never;
  onClick?: () => void;
};

type Props = LinkProps | ButtonProps;

const fabClass = cn(
  // Dimensions: 52px tall, pill shape, padding for icon-only vs labelled
  'inline-flex h-[52px] items-center gap-2 rounded-[26px] border-0 px-[16px]',
  // Volt fill + foreground
  'bg-volt text-[var(--fg-on-volt,#0a0a0f)]',
  // Typography
  'font-body text-[14px] font-bold tracking-[-0.005em]',
  // Cursor
  'cursor-pointer',
  // Position: absolute, above tab bar (bottom: 92px = 76px tab bar + 16px gap)
  'absolute bottom-[92px] right-4 z-[18]',
  // Focus ring
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt',
);

const fabStyle = {
  boxShadow: [
    '0 0 0 1px var(--volt-glow)',
    '0 0 32px -2px var(--volt-glow)',
    '0 12px 32px -8px rgba(0,0,0,0.5)',
    'inset 0 1px 0 rgba(255,255,255,0.3)',
  ].join(', '),
} as const;

/**
 * 52 px floating action button.
 *
 * Positioned `bottom: 92px; right: 16px` — above the 76px tab bar with a
 * 16px gap. Volt fill with a volt bloom shadow.
 *
 * Renders as a `<Link>` when `href` is provided, otherwise a `<button>`.
 * Touch target is 52px × 52px minimum (≥44px §8 prereq met).
 *
 * Matches mobile-shell.jsx `.m-fab` + vitrine-mobile.css.
 */
export function FAB({ label, icon, className, ...rest }: Props) {
  const ariaLabel = rest['aria-label'] ?? label ?? 'add';
  const content = (
    <>
      <span className="inline-flex">{icon ?? <Plus size={20} strokeWidth={2} />}</span>
      {label && <span>{label}</span>}
    </>
  );

  if ('href' in rest && rest.href) {
    return (
      <Link
        href={rest.href}
        aria-label={ariaLabel}
        className={cn(fabClass, className)}
        style={fabStyle}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(rest as ButtonProps).onClick}
      className={cn(fabClass, className)}
      style={fabStyle}
    >
      {content}
    </button>
  );
}
