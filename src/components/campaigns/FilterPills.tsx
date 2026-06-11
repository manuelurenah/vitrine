'use client';

import { Chip, cn } from '@/components/ui';

export type FilterOption = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  options: FilterOption[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
};

export function FilterPills({ options, active, onChange, className }: Props) {
  return (
    <div
      role="group"
      aria-label="filter creatives"
      className={cn(
        'flex items-center gap-2',
        // Mobile: single-row horizontal scroll strip; wider: normal wrapping
        'overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.key === active;
        const label = opt.key === 'all' ? `all ${opt.count}` : `${opt.label} · ${opt.count}`;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={isActive}
            className="cursor-pointer rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-1"
          >
            <Chip active={isActive} aria-hidden="true" tabIndex={-1}>
              {label}
            </Chip>
          </button>
        );
      })}
    </div>
  );
}
