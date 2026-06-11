import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

const fieldBase =
  'w-full bg-bg-2 border border-line rounded-[9px] text-[13.5px] text-fg-0 ' +
  'placeholder:text-fg-3 transition-shadow duration-fast ease-out ' +
  'focus:outline-none focus:border-volt focus:ring-[3px] focus:ring-volt-soft ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger-soft';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(fieldBase, 'h-[38px] px-3 pr-8 appearance-none cursor-pointer', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-2"
      />
    </div>
  );
});
