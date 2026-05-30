import { notFound } from 'next/navigation';
import {
  DnaStep,
  GeneratingStep,
  InputStep,
  NextStep,
  OnboardingFrame,
  WelcomeStep,
  isOnboardingStep,
  type OnboardingStep,
} from '@/components/onboarding';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { recordOnboardingStep } from '@/lib/onboarding';

type Params = Promise<{ step: string }>;

export const dynamic = 'force-dynamic';

export default async function OnboardingStepPage({ params }: { params: Params }) {
  const { step } = await params;
  if (!isOnboardingStep(step)) notFound();

  const session = await getSession();
  if (session) {
    const userKey = await getUserKey(session);
    await recordOnboardingStep(userKey, step);
  }

  return (
    <OnboardingFrame step={step}>
      <Screen step={step} />
    </OnboardingFrame>
  );
}

function Screen({ step }: { step: OnboardingStep }) {
  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'input':
      return <InputStep />;
    case 'generating':
      return <GeneratingStep />;
    case 'dna':
      return <DnaStep />;
    case 'next':
      return <NextStep />;
  }
}
