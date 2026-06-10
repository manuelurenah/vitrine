import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  'aria-label': string;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon, variant = 'ghost', size = 'md', ...rest },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size={size} iconOnly {...rest}>
      {icon}
    </Button>
  );
});
