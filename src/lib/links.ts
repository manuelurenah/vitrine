import { env } from '@/lib/env';

/**
 * Civitai buzz purchase URL, built from the configured Civitai host.
 *
 * Reads `NEXT_PUBLIC_CIVITAI_BASE_URL`, a public client var, so this is safe to
 * call from both server components and `'use client'` "top up" CTAs — no prop
 * threading required.
 */
export function buzzTopUpUrl(): string {
  return `${env.NEXT_PUBLIC_CIVITAI_BASE_URL.replace(/\/$/, '')}/purchase/buzz`;
}
