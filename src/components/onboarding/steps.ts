export const ONBOARDING_STEPS = ['welcome', 'input', 'processing', 'dna', 'next'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function nextStep(current: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(current);
  return i >= 0 && i < ONBOARDING_STEPS.length - 1
    ? (ONBOARDING_STEPS[i + 1] as OnboardingStep)
    : null;
}

export function prevStep(current: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(current);
  return i > 0 ? (ONBOARDING_STEPS[i - 1] as OnboardingStep) : null;
}
