import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  DnaStep,
  InputStep,
  isOnboardingStep,
  OnboardingFrame,
  type OnboardingStep,
  ProcessingStep,
  WelcomeStep,
} from '@/components/onboarding';
import { NextScreen } from '@/components/onboarding/NextScreen';
import { PageTransition } from '@/components/ui';
import { getOnboarding, type OnboardingPayload, recordOnboardingStep } from '@/lib/onboarding';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

type Params = Promise<{ step: string }>;

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OnboardingStepPage({ params }: { params: Params }) {
  const { step } = await params;
  if (!isOnboardingStep(step)) notFound();

  // Onboarding requires a session. Without this guard the page renders
  // anyway but every authenticated API call (scrape, payload patch) 401s,
  // which looks like a bug rather than a missing login.
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  await recordOnboardingStep(userKey, step);
  const snapshot = await getOnboarding(userKey);
  const payload: OnboardingPayload = snapshot.payload;

  return (
    <OnboardingFrame step={step}>
      <PageTransition motionKey={step}>
        <Screen step={step} payload={payload} />
      </PageTransition>
    </OnboardingFrame>
  );
}

function Screen({ step, payload }: { step: OnboardingStep; payload: OnboardingPayload }) {
  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'input':
      return <InputStep payload={payload} />;
    case 'processing':
      return <ProcessingStep payload={payload} />;
    case 'dna':
      return <DnaStep payload={payload} />;
    case 'next':
      return <NextScreen />;
  }
}
