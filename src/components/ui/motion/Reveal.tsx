'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp, motionTokens } from './tokens';

type RevealProps = {
  children: ReactNode;
  className?: string;
  tier?: 'transition' | 'hero';
  delay?: number;
};

/** fadeUp entrance at the given tier. Enter-only: no exit. */
export function Reveal({ children, className, tier = 'transition', delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ ...motionTokens[tier], delay }}
    >
      {children}
    </motion.div>
  );
}

/** Opacity-only entrance for the lightest cases. */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...motionTokens.transition, delay }}
    >
      {children}
    </motion.div>
  );
}
