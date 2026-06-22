'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { motionTokens } from './tokens';

/**
 * Enter-only view transition. Changing `motionKey` re-mounts the inner
 * motion.div (React keys), which replays the entrance. The outgoing view
 * unmounts immediately — there is deliberately no AnimatePresence/exit.
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.transition}
    >
      {children}
    </motion.div>
  );
}
