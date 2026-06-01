'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Dna, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/components/ui';
import type { OnboardingPayload } from '@/lib/onboarding';

type Props = {
  payload: OnboardingPayload;
};

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
            const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
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

  const currentLabel = tasks.find((t) => t.status === 'running')?.label;

  return (
    <section className="flex flex-col items-center gap-12 pt-16 text-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-[-30px] rounded-pill opacity-90"
          style={{
            background: 'radial-gradient(circle at center, var(--volt-glow) 0%, transparent 65%)',
            filter: 'blur(30px)',
          }}
        />
        <div className="relative grid h-[96px] w-[96px] place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt shadow-bloom-volt">
          <Dna size={36} strokeWidth={1.75} />
        </div>
      </div>

      <header className="flex flex-col items-center gap-3">
        <span className="t-eyebrow">// extracting your brand dna</span>
        <h2 className="t-h2 text-fg-0">cooking your brand dna.</h2>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-fg-2">
          {error ? 'something went wrong' : (currentLabel ?? 'almost there')}…
        </p>
      </header>

      <ul className="flex w-full max-w-[460px] flex-col gap-2 text-left">
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
        'flex items-center gap-3 rounded-[10px] border px-3 py-[10px] transition-colors duration-fast ease-out',
        done && 'border-line-volt bg-volt-soft text-fg-0',
        live && 'border-line-strong bg-bg-2 text-fg-0',
        skip && 'border-line-subtle bg-bg-1 text-fg-3',
        err && 'border-danger bg-danger-soft text-fg-0',
        !done && !live && !skip && !err && 'border-line-subtle bg-bg-1 text-fg-2',
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 place-items-center rounded-pill border',
          done && 'border-line-volt bg-volt text-fg-on-volt',
          live && 'border-line-volt bg-volt-soft text-volt',
          skip && 'border-line bg-bg-3 text-fg-3',
          err && 'border-danger bg-danger text-fg-on-volt',
          !done && !live && !skip && !err && 'border-line bg-bg-3 text-fg-3',
        )}
      >
        {done ? (
          <Check size={12} strokeWidth={3} />
        ) : live ? (
          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
        ) : err ? (
          <TriangleAlert size={11} strokeWidth={2.5} />
        ) : (
          <span className="h-[6px] w-[6px] rounded-pill bg-current" />
        )}
      </span>
      <span className="flex-1 text-[13.5px]">{task.label}</span>
      {skip && (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">skipped</span>
      )}
    </li>
  );
}

function initialTasks(payload: OnboardingPayload): Task[] {
  return [
    { key: 'logo', label: 'uploading logo', status: payload.logoUrl ? 'pending' : 'pending' },
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
