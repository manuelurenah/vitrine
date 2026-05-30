import { cn } from '@/components/ui';

type Props = { size?: number; className?: string };

export function Wordmark({ size = 24, className }: Props) {
  return (
    <span
      className={cn('font-display font-extrabold leading-none text-fg-0', className)}
      style={{
        fontSize: size,
        letterSpacing: '-0.04em',
        fontVariationSettings: `"opsz" ${Math.min(size, 48)}`,
      }}
    >
      <span
        className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent"
      >
        v
      </span>
      itrine
    </span>
  );
}
