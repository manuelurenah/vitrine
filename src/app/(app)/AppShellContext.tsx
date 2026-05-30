import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import type { ShellUser } from '@/lib/user';

type Props = {
  user: ShellUser;
  buzzBalance?: number;
  children: ReactNode;
};

/**
 * Server wrapper around <Shell>. Currently a thin pass-through; kept as its own
 * component so route segments can later inject crumbs / back via context without
 * re-fetching session in every page.
 */
export function AppShellProvider({ user, buzzBalance, children }: Props) {
  return (
    <Shell user={user} buzzBalance={buzzBalance}>
      {children}
    </Shell>
  );
}
