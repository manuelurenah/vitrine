'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Staggers the entrance of direct Reveal/FadeIn children. The children use
 * variants ("hidden"/"show"); this parent drives them via staggerChildren.
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
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}
