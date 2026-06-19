import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type Props = {
  /** Pixel size of the spinner. Defaults to 16. */
  size?: number;
  /** Extra classes — use a text color utility (e.g. `text-volt`) to set the accent. */
  className?: string;
  /** Accessible label. Set to `null` for a decorative spinner inside an already-labelled element. */
  label?: string | null;
  strokeWidth?: number;
};

/**
 * The single loading-spinner primitive for the app. Wraps lucide's `Loader2`
 * with the consolidated defaults (continuous spin, 1.75 stroke, `currentColor`)
 * so every loading state looks the same. Color is inherited — pass `text-volt`
 * for primary/brand loaders, `text-fg-3` for muted inline ones.
 */
export function Spinner({ size = 16, className, label = 'loading', strokeWidth = 1.75 }: Props) {
  return (
    <Loader2
      size={size}
      strokeWidth={strokeWidth}
      className={cn('animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
