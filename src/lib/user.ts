import 'server-only';
import type { MeResponse } from './civitai';

export function initialsFromName(input: string): string {
  const cleaned = input.trim();
  if (!cleaned) return '··';
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export type ShellUser = { initials: string; name: string; tier?: string };

export function shellUserFromMe(me: MeResponse | null | undefined): ShellUser {
  const name = me?.username ?? 'studio';
  return {
    name,
    initials: initialsFromName(name),
    tier: 'creator · vitrine',
  };
}
