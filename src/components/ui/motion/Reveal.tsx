'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useInStagger } from './StaggerContext';
import { fade, fadeUp, motionTokens } from './tokens';

type RevealProps = {
  children: ReactNode;
  className?: string;
  tier?: 'transition' | 'hero';
  delay?: number;
};

/** fadeUp entrance at the given tier. Enter-only: no exit. Inside a Stagger it
 *  defers initial/animate to the parent so staggerChildren can sequence it. */
export function Reveal({ children, className, tier = 'transition', delay = 0 }: RevealProps) {
  const inStagger = useInStagger();
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial={inStagger ? undefined : 'hidden'}
      animate={inStagger ? undefined : 'show'}
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
  const inStagger = useInStagger();
  return (
    <motion.div
      className={className}
      variants={fade}
      initial={inStagger ? undefined : 'hidden'}
      animate={inStagger ? undefined : 'show'}
      transition={{ ...motionTokens.transition, delay }}
    >
      {children}
    </motion.div>
  );
}
