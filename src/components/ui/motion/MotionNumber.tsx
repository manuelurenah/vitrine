'use client';

import { animate, useMotionValue, useTransform } from 'motion/react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { motionTokens } from './tokens';

/**
 * Animated integer count. SSR/first paint renders the exact formatted value so
 * the number is correct without JS; on subsequent `value` changes the displayed
 * count rolls from the previous value to the new one.
 */
export function MotionNumber({ value, className }: { value: number; className?: string }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const controls = animate(count, value, motionTokens.transition);
    prev.current = value;
    return () => controls.stop();
  }, [value, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
