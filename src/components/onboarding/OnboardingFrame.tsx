'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/shell';
import { ONBOARDING_STEPS, type OnboardingStep } from './steps';
import { useOnboardingKeyboardNav } from './useOnboardingKeyboardNav';

type Props = {
  step: OnboardingStep;
  children: ReactNode;
  skipHref?: string;
};

export function OnboardingFrame({ step, children, skipHref = '/onboarding/dna' }: Props) {
  useOnboardingKeyboardNav(step);
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 900px 540px at 50% -10%, var(--volt-soft), transparent 60%),' +
            'radial-gradient(ellipse 800px 480px at 92% 110%, var(--ultraviolet-soft), transparent 60%)',
        }}
      />

      <header className="relative z-card flex items-center justify-between px-10 py-6">
        <Link href="/onboarding/welcome">
          <Wordmark size={26} />
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            {ONBOARDING_STEPS.map((s, i) => (
              <span
                key={s}
                className="h-[6px] w-[28px] rounded-pill"
                style={{
                  background: i <= stepIndex ? 'var(--volt)' : 'var(--line-subtle)',
                  boxShadow: i === stepIndex ? '0 0 12px -2px var(--volt-glow)' : undefined,
                }}
              />
            ))}
          </div>
          <Link
            href={skipHref}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 transition-colors duration-fast ease-out hover:text-fg-1"
          >
            skip →
          </Link>
        </div>
      </header>

      <main className="relative z-card mx-auto w-full max-w-[1080px] px-10 pb-16">{children}</main>
    </div>
  );
}
