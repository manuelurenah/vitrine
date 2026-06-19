'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn, Spinner } from '@/components/ui';

/**
 * Placeholder tile rendered in the asset library while an ad-hoc generation is
 * still in flight. It long-polls the workflow route until the workflow reaches
 * a terminal status, then calls `onDone` so the gallery can refresh and surface
 * the newly-saved assets. The workflow route auto-persists ad-hoc results as
 * assets on terminal success, so there is no separate save step.
 */
export function CookingAssetCard({
  workflowId,
  onDone,
}: {
  workflowId: string;
  onDone: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);

  // Keep the latest onDone in a ref so the poll effect can call it WITHOUT
  // listing it as a dependency. If `onDone` were a dependency, a new callback
  // identity on every parent render would tear down and restart the loop,
  // firing an immediate refetch each time — a request storm that pegs the page
  // (especially after completion, when refresh → re-render → refetch → done
  // → refresh would tight-loop until the server stops listing the workflow).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          const data = (await res.json().catch(() => ({}))) as {
            snapshot?: { status?: string };
            done?: boolean;
          };
          if (cancelled) return;
          if (data.done) {
            const status = String(data.snapshot?.status ?? '').toLowerCase();
            if (status.includes('fail') || status.includes('error') || status.includes('cancel')) {
              setFailed(true);
              return;
            }
            onDoneRef.current(workflowId);
            return;
          }
          // Not terminal. The server long-poll already held ~wait ms, but pace
          // defensively so a fast/early return (error JSON, wait=0, immediate
          // non-terminal) can never become a hot loop.
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  return (
    <div
      data-testid="cooking-asset-card"
      className={cn(
        'relative flex aspect-square flex-col overflow-hidden rounded-[12px] border bg-bg-2',
        failed ? 'border-danger' : 'border-line-subtle',
      )}
    >
      <div className="relative flex-1 overflow-hidden bg-bg-3">
        {!failed && <div aria-hidden className="absolute inset-0 animate-pulse bg-bg-3" />}
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <span
              className={cn(
                'grid h-9 w-9 place-items-center rounded-pill border',
                failed
                  ? 'border-danger bg-danger-soft text-danger'
                  : 'border-line-volt bg-volt-soft text-volt shadow-bloom-volt-sm',
              )}
            >
              {failed ? (
                <Sparkles size={16} strokeWidth={1.75} />
              ) : (
                <Spinner size={16} label={null} />
              )}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-2">
              {failed ? 'failed' : 'cooking…'}
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-line-subtle bg-bg-2 px-2.5 py-2">
        <div className="truncate text-[12px] text-fg-0">
          {failed ? 'generation failed' : 'generating…'}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">
          generated · adhoc
        </div>
      </div>
    </div>
  );
}
