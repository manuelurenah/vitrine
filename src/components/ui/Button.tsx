import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'tonal';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
};

const base =
  'inline-flex items-center gap-[7px] whitespace-nowrap border-0 font-body font-semibold ' +
  'tracking-[-0.005em] transition-all duration-base ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-0 ' +
  'disabled:cursor-not-allowed motion-safe:active:scale-[0.97]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-volt text-fg-on-volt shadow-bloom-volt-sm hover:bg-volt-hover active:translate-y-[1px] ' +
    'disabled:bg-bg-3 disabled:text-fg-3 disabled:shadow-none',
  secondary:
    'bg-bg-2 text-fg-0 border border-line hover:bg-bg-3 hover:border-line-strong ' +
    'disabled:bg-bg-3 disabled:text-fg-3',
  ghost:
    'bg-transparent text-fg-1 hover:bg-bg-2 hover:text-fg-0 ' +
    'disabled:text-fg-3 disabled:hover:bg-transparent',
  tonal:
    'bg-volt-soft text-volt border border-line-volt hover:brightness-110 ' +
    'disabled:bg-bg-3 disabled:text-fg-3 disabled:border-line',
};

// Height / text / radius only — horizontal padding is applied separately so
// icon-only buttons don't emit a conflicting `px-*` class. `cn` is a plain
// join (no tailwind-merge), so two `px-*` utilities would both render and the
// arbitrary value wins regardless of order, squeezing the icon.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 text-xs rounded-[7px]',
  md: 'h-9 text-[13.5px] rounded-[9px]',
  lg: 'h-11 text-[14.5px] rounded-[10px]',
};

const paddingX: Record<ButtonSize, string> = {
  sm: 'px-[10px]',
  md: 'px-[14px]',
  lg: 'px-[22px]',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-7 justify-center',
  md: 'w-9 justify-center',
  lg: 'w-11 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    iconOnly,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        sizes[size],
        iconOnly ? iconSizes[size] : paddingX[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
