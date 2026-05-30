import { cn } from '@/components/ui';

export type ThumbTone = 'volt' | 'ion' | 'ultraviolet' | 'flux' | 'buzz';

const tones: Record<ThumbTone, string> = {
  volt: 'from-volt/40 via-bg-2 to-ion/20',
  ion: 'from-ion/40 via-bg-2 to-volt/15',
  ultraviolet: 'from-ultraviolet/40 via-bg-2 to-flux/20',
  flux: 'from-flux/40 via-bg-2 to-ultraviolet/20',
  buzz: 'from-buzz/40 via-bg-2 to-flux/15',
};

type Props = {
  tone?: ThumbTone;
  className?: string;
  children?: React.ReactNode;
};

export function GradientThumb({ tone = 'volt', className, children }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[12px] bg-gradient-to-br',
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
