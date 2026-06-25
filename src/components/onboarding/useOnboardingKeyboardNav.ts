'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type OnboardingStep, nextStep, prevStep } from './steps';

type Options = {
  /**
   * Optional callback checked before ArrowRight navigation. Return false to
   * block forward navigation (e.g. when the current step has unmet requirements).
   * Backward navigation (ArrowLeft) is never blocked.
   */
  canAdvance?: () => boolean;
};

/**
 * Mounts a keydown listener for ArrowLeft / ArrowRight to navigate between
 * onboarding steps. Ignores keypresses when:
 * - A form control is focused (input, textarea, select, contenteditable)
 * - A modifier key is held (Ctrl, Meta, Alt, Shift)
 * - `canAdvance` returns false (ArrowRight only)
 *
 * Pass `null` for `currentStep` to disable the listener entirely (e.g. when
 * a child step component registers its own listener with a `canAdvance` guard).
 */
export function useOnboardingKeyboardNav(
  currentStep: OnboardingStep | null,
  { canAdvance }: Options = {},
) {
  const router = useRouter();

  useEffect(() => {
    // Disabled — child component owns the keyboard nav for this step.
    if (currentStep === null) return;

    function onKey(e: KeyboardEvent) {
      if (currentStep === null) return;
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
        // Block forward nav when the caller says the current step isn't ready.
        if (canAdvance && !canAdvance()) return;
        const next = nextStep(currentStep);
        if (next) router.push(`/onboarding/${next}`);
      } else if (e.key === 'ArrowLeft') {
        const prev = prevStep(currentStep);
        if (prev) router.push(`/onboarding/${prev}`);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentStep, router, canAdvance]);
}
