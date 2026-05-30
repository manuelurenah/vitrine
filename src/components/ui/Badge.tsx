import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeKind = 'live' | 'gen' | 'cooking' | 'draft' | 'archived';

type Props = HTMLAttributes<HTMLSpanElement> & {
  kind?: BadgeKind;
};

const base =
  'inline-flex items-center gap-[5px] font-mono font-medium uppercase ' +
  'text-[10px] tracking-[0.05em] px-2 py-[3px] rounded-[6px] leading-none';

const kinds: Record<BadgeKind, { wrap: string; dot: string }> = {
  live: { wrap: 'bg-volt-soft text-volt', dot: 'bg-volt shadow-[0_0_8px_var(--volt-glow)]' },
  gen: { wrap: 'bg-ion-soft text-ion', dot: 'bg-ion' },
  cooking: { wrap: 'bg-ion-soft text-ion', dot: 'bg-ion' },
  draft: { wrap: 'bg-bg-3 text-fg-1', dot: 'bg-fg-2' },
  archived: { wrap: 'bg-bg-3 text-fg-2', dot: 'bg-fg-3' },
};

export const Badge = forwardRef<HTMLSpanElement, Props>(function Badge(
  { kind = 'draft', className, children, ...rest },
  ref,
) {
  const k = kinds[kind];
  return (
    <span ref={ref} className={cn(base, k.wrap, className)} {...rest}>
      <span className={cn('h-[6px] w-[6px] rounded-pill', k.dot)} aria-hidden />
      {children}
    </span>
  );
});
