'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { motionTokens } from './tokens';

/**
 * Enter-only view transition. Changing `motionKey` re-mounts the inner
 * motion.div (React keys), which replays the entrance. The outgoing view
 * unmounts immediately — there is deliberately no AnimatePresence/exit.
 *
 * Opacity-ONLY by design: this wrapper wraps whole route/wizard-step subtrees,
 * which can contain `position: fixed` overlays (e.g. the campaign drafting
 * overlay, modals). Any transform (a `y`/slide animation leaves one on the
 * element) would make this div the containing block for those fixed
 * descendants, re-rooting `inset-0` from the viewport to this wrapper and
 * collapsing the overlay. A pure-opacity fade creates no containing block, so
 * fixed positioning keeps resolving against the viewport.
 */
export function PageTransition({
  motionKey,
  children,
  className,
}: {
  motionKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      key={motionKey}
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionTokens.transition}
    >
      {children}
    </motion.div>
  );
}
