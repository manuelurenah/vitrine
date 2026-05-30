import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

type Props = {
  title: string;
  count?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionHead({ title, count, icon, action, className }: Props) {
  return (
    <div className={cn('mb-4 flex items-center gap-[10px]', className)}>
      {icon && <span className="text-fg-2">{icon}</span>}
      <span className="text-[14px] font-medium text-fg-0">{title}</span>
      {count && <span className="font-mono text-[11.5px] text-fg-3">· {count}</span>}
      {action && <span className="ml-auto text-[12.5px] text-fg-2 hover:text-fg-0">{action}</span>}
    </div>
  );
}
