import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

type Props = HTMLAttributes<HTMLDivElement> & {
  initials: string;
  size?: number;
  brand?: boolean;
};

export const Avatar = forwardRef<HTMLDivElement, Props>(function Avatar(
  { initials, size = 32, brand = false, className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill font-semibold uppercase leading-none',
        brand
          ? 'bg-gradient-to-br from-volt to-ion text-fg-on-volt border-0'
          : 'bg-volt-soft text-volt border border-line-volt',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...style }}
      {...rest}
    >
      {initials}
    </div>
  );
});
