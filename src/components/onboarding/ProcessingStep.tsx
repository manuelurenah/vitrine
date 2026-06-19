'use client';

import { Check, Dna, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import type { OnboardingPayload } from '@/lib/onboarding';

type Props = {
  payload: OnboardingPayload;
};

// Task labels cycle — exact design copy per gap-plan §2.3
const GEN_LABELS = [
  'reading your site',
  'extracting palette',
  'tasting your tone of voice',
  'sketching your audience',
  'naming the read',
] as const;

type TaskKey = 'logo' | 'scrape' | 'palette' | 'font' | 'finalize';
type TaskStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

type Task = {
  key: TaskKey;
  label: string;
  status: TaskStatus;
};

export function ProcessingStep({ payload }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(() => initialTasks(payload));
  const [error, setError] = useState<string | null>(null);
  // Guard against double-runs in React strict mode + dev fast refresh.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void run();

    async function run() {
      const url = payload.websiteUrl?.trim();
      const alreadyScraped =
        payload.scrape && payload.scrape.finalUrl && url
          ? normalizeForCompare(payload.scrape.finalUrl) === normalizeForCompare(url)
          : false;

      // Logo upload happens in InputStep — by the time we land here the
      // public URL is already in the payload, so the "logo" task is just a
      // visual confirmation.
      if (payload.logoUrl) await stepTask('logo', 250);
      else markSkipped('logo');

      if (url && !alreadyScraped) {
        setStatus('scrape', 'running');
        try {
          const res = await fetch('/api/onboarding/scrape', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ url }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
              detail?: string;
            };
            throw new Error(body.detail ?? body.error ?? `scrape http ${res.status}`);
          }
          setStatus('scrape', 'done');
          await delay(180);
          await stepTask('palette', 300);
          await stepTask('font', 280);
        } catch (err) {
          setStatus('scrape', 'error');
          setError(err instanceof Error ? err.message : 'scrape failed');
          return;
        }
      } else {
        if (url) {
          // scrape already on file — surface as done so the user sees a tick
          setStatus('scrape', 'done');
        } else {
          markSkipped('scrape');
        }
        if (payload.scrape?.palette?.length) await stepTask('palette', 220);
        else markSkipped('palette');
        if (payload.scrape?.font) await stepTask('font', 220);
        else markSkipped('font');
      }

      await stepTask('finalize', 200);
      router.push('/onboarding/dna');
    }

    function markSkipped(key: TaskKey) {
      setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status: 'skipped' } : t)));
    }
    function setStatus(key: TaskKey, status: TaskStatus) {
      setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status } : t)));
    }
    async function stepTask(key: TaskKey, durationMs: number) {
      setStatus(key, 'running');
      await delay(durationMs);
      setStatus(key, 'done');
    }
    function delay(ms: number) {
      return new Promise((r) => setTimeout(r, ms));
    }
  }, [payload, router]);

  // Cycle through design label copy at ~850ms each, independent of actual task progress
  const [labelTick, setLabelTick] = useState(0);
  const labelTickRef = useRef(false);
  useEffect(() => {
    if (labelTickRef.current) return;
    labelTickRef.current = true;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLabelTick(i);
      if (i >= GEN_LABELS.length) clearInterval(id);
    }, 850);
    return () => clearInterval(id);
  }, []);

  const currentGenLabel = GEN_LABELS[Math.min(labelTick, GEN_LABELS.length - 1)];

  return (
    <section className="flex flex-col items-center gap-8 pt-16 text-center">
      <span className="t-eyebrow">// extracting your brand dna</span>

      {/* Orb with pulse rings — pulse-ring 2.4s, second ring +1.2s delay, dna-rotate 6s linear */}
      <div className="relative grid h-[96px] w-[96px] place-items-center">
        {/* outer glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-30px] rounded-pill opacity-90"
          style={{
            background: 'radial-gradient(circle at center, var(--volt-glow) 0%, transparent 65%)',
            filter: 'blur(30px)',
          }}
        />
        {/* pulse ring 1 */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-pill border border-line-volt"
          style={{ animation: 'pulse-ring 2.4s ease-out infinite' }}
        />
        {/* pulse ring 2 — delayed */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-pill border border-line-volt"
          style={{ animation: 'pulse-ring 2.4s ease-out 1.2s infinite' }}
        />
        {/* orb body */}
        <div className="relative grid h-[96px] w-[96px] place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt shadow-bloom-volt">
          <Dna
            size={36}
            strokeWidth={1.75}
            style={{ animation: 'dna-rotate 6s linear infinite' }}
          />
        </div>
      </div>

      <header className="flex flex-col items-center gap-2">
        <h2 className="t-h2 text-fg-0">
          we&apos;re{' '}
          <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
            cooking
          </span>{' '}
          your brand DNA.
        </h2>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-fg-2">
          {error ? 'something went wrong' : currentGenLabel}
          {!error && <span className="inline-block animate-pulse">…</span>}
        </p>
      </header>

      {/* Browser preview with scanner + shimmer skeleton */}
      <div
        className="w-[420px] max-w-full overflow-hidden rounded-[14px] border border-line"
        style={{ background: 'var(--bg-2)' }}
        aria-hidden="true"
      >
        {/* browser chrome */}
        <div className="flex h-8 items-center gap-[6px] border-b border-white/[0.06] px-3 bg-bg-3">
          <span className="h-2 w-2 rounded-pill bg-fg-3 opacity-50" />
          <span className="h-2 w-2 rounded-pill bg-fg-3 opacity-50" />
          <span className="h-2 w-2 rounded-pill bg-fg-3 opacity-50" />
          <span className="ml-auto font-mono text-[11px] text-fg-2">your-shop.co</span>
        </div>
        {/* preview body */}
        <div className="relative h-[150px] overflow-hidden bg-bg-1">
          {/* skeleton lines */}
          <div className="absolute inset-[14px] flex flex-col gap-2">
            <div
              className="h-2 rounded-[4px]"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, var(--bg-2), var(--bg-3), var(--bg-2))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }}
            />
            <div
              className="h-2 rounded-[4px]"
              style={{
                width: '70%',
                background: 'linear-gradient(90deg, var(--bg-2), var(--bg-3), var(--bg-2))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite 0.3s',
              }}
            />
            <div
              className="flex-1 rounded-[6px]"
              style={{
                background: 'linear-gradient(120deg, var(--bg-2), var(--bg-3), var(--bg-2))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.4s linear infinite',
              }}
            />
            <div
              className="h-2 rounded-[4px]"
              style={{
                width: '55%',
                background: 'linear-gradient(90deg, var(--bg-2), var(--bg-3), var(--bg-2))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite 0.6s',
              }}
            />
          </div>
          {/* scanner line — scan 0→100% 2.6s ease-in-out */}
          <div
            className="absolute left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--volt), transparent)',
              boxShadow: '0 0 8px var(--volt)',
              animation: 'scan 2.6s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Checklist — mirrors actual task progress */}
      <ul className="flex w-full max-w-[420px] flex-col gap-[10px] text-left">
        {tasks.map((task) => (
          <TaskRow key={task.key} task={task} />
        ))}
      </ul>

      {error && (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-danger bg-danger-soft px-4 py-3 text-[13px] text-fg-0">
          <p className="flex items-center gap-2">
            <TriangleAlert size={14} strokeWidth={2} className="text-danger" />
            {error}
          </p>
          <Link
            href="/onboarding/input"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-volt hover:text-fg-0"
          >
            ← back to inputs
          </Link>
        </div>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === 'done';
  const live = task.status === 'running';
  const skip = task.status === 'skipped';
  const err = task.status === 'error';
  return (
    <li
      className={cn(
        'flex items-center gap-[10px] text-[14px] transition-colors duration-[240ms] ease-out',
        done && 'text-fg-1',
        live && 'text-fg-0',
        skip && 'text-fg-3',
        err && 'text-fg-0',
        !done && !live && !skip && !err && 'text-fg-3',
      )}
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-pill border transition-all duration-[240ms] ease-out',
          done && 'border-line-volt bg-volt text-fg-on-volt',
          live && 'border-line-volt bg-volt-soft',
          skip && 'border-line bg-bg-3 text-fg-3',
          err && 'border-danger bg-danger text-fg-on-volt',
          !done && !live && !skip && !err && 'border-line bg-bg-3 text-fg-3',
        )}
      >
        {done ? (
          <Check size={10} strokeWidth={3.5} />
        ) : live ? (
          <span
            className="h-[7px] w-[7px] rounded-pill bg-volt"
            style={{ animation: 'dot-pulse 1s ease-in-out infinite' }}
          />
        ) : err ? (
          <TriangleAlert size={11} strokeWidth={2.5} />
        ) : (
          <span className="h-[6px] w-[6px] rounded-pill bg-current" />
        )}
      </span>
      <span className="flex-1">{task.label}</span>
      {skip && (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">skipped</span>
      )}
    </li>
  );
}

function initialTasks(payload: OnboardingPayload): Task[] {
  return [
    { key: 'logo', label: 'uploading logo', status: 'pending' },
    { key: 'scrape', label: 'reading your site', status: 'pending' },
    { key: 'palette', label: 'extracting palette', status: 'pending' },
    { key: 'font', label: 'detecting brand font', status: 'pending' },
    { key: 'finalize', label: 'finalizing your dna', status: 'pending' },
  ];
}

function normalizeForCompare(u: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    return url.hostname.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
  } catch {
    return u.trim().toLowerCase();
  }
}
