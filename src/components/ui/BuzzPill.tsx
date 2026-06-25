import { forwardRef, type HTMLAttributes } from 'react';
import { BuzzGlyph } from './BuzzGlyph';
import { cn } from './cn';
import { MotionNumber } from './motion';

export const GREEN_BUZZ_TOOLTIP =
  'Vitrine spends green Buzz from your Civitai wallet — not your scarce yellow Buzz.';

type Props = HTMLAttributes<HTMLSpanElement> & {
  amount: number;
  size?: 'compact' | 'default';
};

const base =
  'inline-flex items-center gap-[6px] font-mono leading-none ' +
  'bg-buzz-soft border border-buzz-border rounded-pill text-buzz';

const sizes = {
  compact: 'px-2 py-[3px] text-[11px]',
  default: 'px-[10px] py-[5px] text-xs',
};

export const BuzzPill = forwardRef<HTMLSpanElement, Props>(function BuzzPill(
  { amount, size = 'default', className, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn(base, sizes[size], className)} {...rest}>
      <BuzzGlyph size={size === 'compact' ? 12 : 14} />
      <MotionNumber value={amount} />
    </span>
  );
});
