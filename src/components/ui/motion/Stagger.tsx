'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { StaggerContext } from './StaggerContext';

/**
 * Staggers the entrance of direct Reveal/FadeIn children. The children declare
 * variants ("hidden"/"show") and (via StaggerContext) defer their initial/animate
 * to this parent, which drives them with staggerChildren.
 */
export function Stagger({
  children,
  className,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <StaggerContext.Provider value={true}>
      <motion.div
        className={className}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
      >
        {children}
      </motion.div>
    </StaggerContext.Provider>
  );
}
