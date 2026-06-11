'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type OnboardingStep, nextStep, prevStep } from './steps';

/**
 * Mounts a keydown listener for ArrowLeft / ArrowRight to navigate between
 * onboarding steps. Ignores keypresses when:
 * - A form control is focused (input, textarea, select, contenteditable)
 * - A modifier key is held (Ctrl, Meta, Alt, Shift)
 */
export function useOnboardingKeyboardNav(currentStep: OnboardingStep) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip when modifier is held
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      // Skip when a form control or contenteditable is focused
      const target = e.target as Element | null;
      if (target) {
        const tag = (target as HTMLElement).tagName?.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (target as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if (e.key === 'ArrowRight') {
        const next = nextStep(currentStep);
        if (next) router.push(`/onboarding/${next}`);
      } else if (e.key === 'ArrowLeft') {
        const prev = prevStep(currentStep);
        if (prev) router.push(`/onboarding/${prev}`);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentStep, router]);
}
