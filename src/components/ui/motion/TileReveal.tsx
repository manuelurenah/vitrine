'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { motionTokens, scaleIn } from './tokens';

/** Hero entrance for a finished generation tile. Enter-only. */
export function TileReveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={scaleIn}
      initial="hidden"
      animate="show"
      transition={motionTokens.hero}
    >
      {children}
    </motion.div>
  );
}
