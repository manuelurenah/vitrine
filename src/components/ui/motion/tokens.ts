import type { Transition, Variants } from 'motion/react';

/**
 * Single source of truth for motion timing, mirroring how globals.css is the
 * single source for color/spacing tokens. Three intensity tiers:
 *  - feedback   : repeated/utility surfaces (hovers, taps, selection)
 *  - transition : content entrance, route/wizard/step changes
 *  - hero       : rare/expressive moments (login, result reveal, buzz spend)
 */
export const motionTokens = {
  feedback: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  hero: { type: 'spring', stiffness: 320, damping: 26 },
} as const satisfies Record<string, Transition>;

/** Shared enter-only variants. No `exit` key — exits are intentionally omitted. */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
} as const satisfies Variants;

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1 },
} as const satisfies Variants;
