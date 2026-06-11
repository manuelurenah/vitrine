'use client';

import type { OnboardingPayload } from '@/lib/onboarding';
import { DnaStep } from './DnaStep';
import { NextChoiceModal } from './NextChoiceModal';

type Props = {
  payload: OnboardingPayload;
};

/**
 * Renders the DNA screen dimmed behind a scrim, with the "what's next?"
 * choice modal overlaid on top.
 *
 * The DNA content is pointer-events-none and faded so the user can see
 * the context they just completed, but interaction is locked to the modal.
 */
export function NextScreen({ payload }: Props) {
  function handleClose() {
    // Navigation is handled by NextChoiceModal (router.push('/campaigns'))
  }

  return (
    <>
      {/* DNA screen — dimmed, non-interactive */}
      <div className="pointer-events-none select-none opacity-30" aria-hidden>
        <DnaStep payload={payload} />
      </div>

      {/* Choice modal — always open on this screen */}
      <NextChoiceModal onClose={handleClose} />
    </>
  );
}
