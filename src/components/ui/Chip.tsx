import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type Props = HTMLAttributes<HTMLSpanElement> & {
  active?: boolean;
  ghost?: boolean;
  leadingIcon?: ReactNode;
};

const base =
  'inline-flex items-center gap-[6px] select-none cursor-pointer ' +
  'font-body text-xs font-medium leading-none ' +
  'rounded-pill px-[11px] py-[5px] border transition duration-fast ease-out motion-safe:active:scale-[0.96]';

const idle = 'bg-bg-2 text-fg-1 border-line hover:text-fg-0 hover:border-line-strong';
const activeCls = 'bg-volt-soft text-volt border-line-volt hover:border-line-volt';
const ghostCls = 'bg-transparent';

export const Chip = forwardRef<HTMLSpanElement, Props>(function Chip(
  { active = false, ghost = false, leadingIcon, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      data-active={active ? '' : undefined}
      className={cn(base, active ? activeCls : idle, ghost && ghostCls, className)}
      {...rest}
    >
      {active && (
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
      {leadingIcon}
      {children}
    </span>
  );
});
