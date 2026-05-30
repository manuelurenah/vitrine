'use client';

import { useEffect, useState } from 'react';
import { Check, Dna } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui';

const TASKS = [
  'reading your site',
  'extracting palette',
  'tasting your tone of voice',
  'sketching your audience',
  'naming the read',
] as const;

const PER_TASK_MS = 850;

export function GeneratingStep() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (progress >= TASKS.length) {
      const t = setTimeout(() => router.push('/onboarding/dna'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setProgress((p) => p + 1), PER_TASK_MS);
    return () => clearTimeout(t);
  }, [progress, router]);

  return (
    <section className="flex flex-col items-center gap-12 pt-16 text-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-[-30px] rounded-pill opacity-90"
          style={{
            background:
              'radial-gradient(circle at center, var(--volt-glow) 0%, transparent 65%)',
            filter: 'blur(30px)',
          }}
        />
        <div className="relative grid h-[96px] w-[96px] place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt shadow-bloom-volt">
          <Dna size={36} strokeWidth={1.75} />
        </div>
      </div>

      <header className="flex flex-col items-center gap-3">
        <h2 className="t-h2 text-fg-0">we&apos;re cooking your brand dna.</h2>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-fg-2">
          {TASKS[Math.min(progress, TASKS.length - 1)]}…
        </p>
      </header>

      <ul className="flex w-full max-w-[460px] flex-col gap-2 text-left">
        {TASKS.map((task, i) => {
          const done = i < progress;
          const live = i === progress;
          return (
            <li
              key={task}
              className={cn(
                'flex items-center gap-3 rounded-[10px] border px-3 py-[10px] transition-colors duration-fast ease-out',
                done && 'border-line-volt bg-volt-soft text-fg-0',
                live && 'border-line-strong bg-bg-2 text-fg-0',
                !done && !live && 'border-line-subtle bg-bg-1 text-fg-2',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-pill border',
                  done && 'border-line-volt bg-volt text-fg-on-volt',
                  live && 'border-line-volt bg-volt-soft text-volt',
                  !done && !live && 'border-line bg-bg-3 text-fg-3',
                )}
              >
                {done ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span className="h-[6px] w-[6px] rounded-pill bg-current" />
                )}
              </span>
              <span className="text-[13.5px]">{task}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
