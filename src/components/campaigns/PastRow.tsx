import { Trash2 } from 'lucide-react';
import { Badge, type BadgeKind, cn } from '@/components/ui';
import { GradientThumb, type ThumbTone } from './GradientThumb';

type Props = {
  name: string;
  date: string;
  count: string;
  status?: BadgeKind | null;
  tone?: ThumbTone;
  last?: boolean;
  busy?: boolean;
  onDelete?: () => void;
};

export function PastRow({ name, date, count, status, tone, last, busy, onDelete }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-[10px] transition-colors duration-fast ease-out hover:bg-bg-3',
        !last && 'border-b border-line-subtle',
      )}
    >
      <GradientThumb tone={tone} className="h-10 w-10 shrink-0 rounded-[8px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-fg-0">{name}</div>
        <div className="mt-[2px] font-mono text-[11px] text-fg-2">
          {date} · {count}
        </div>
      </div>
      {status && <Badge kind={status}>{status}</Badge>}
      {onDelete && (
        <button
          type="button"
          aria-label="delete campaign"
          disabled={busy}
          onClick={(e) => {
            // Row is wrapped in a Link — keep the click from navigating.
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-fg-2 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-danger disabled:opacity-50"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
