import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

const fieldBase =
  'w-full bg-bg-2 border border-line rounded-[9px] text-[13.5px] text-fg-0 ' +
  'placeholder:text-fg-3 transition-shadow duration-fast ease-out ' +
  'focus:outline-none focus:border-volt focus:ring-[3px] focus:ring-volt-soft ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger-soft';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={cn(fieldBase, 'h-[38px] px-3', className)} {...rest} />;
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, 'min-h-[70px] resize-y px-3 py-[10px] leading-[1.5] font-body', className)}
      {...rest}
    />
  );
});

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function FieldLabel({ className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      className={cn(
        'block mb-[6px] font-mono text-[10px] uppercase tracking-[0.1em] text-fg-2',
        className,
      )}
      {...rest}
    >
      {children}
    </label>
  );
}
