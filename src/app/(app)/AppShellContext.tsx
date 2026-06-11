import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import type { ShellUser } from '@/lib/user';

type Props = {
  user: ShellUser;
  buzzBalance?: number;
  children: ReactNode;
};

/**
 * Server wrapper around <AppShell>. Passes server-fetched user data and buzz
 * balance through to the client component that handles the responsive
 * mobile/desktop shell switch. Children are server-rendered RSC subtrees passed
 * through the client boundary — they are not re-rendered on the client.
 *
 * Kept as its own component so route segments can later inject crumbs / back
 * via context without re-fetching session in every page.
 */
export function AppShellProvider({ user, buzzBalance, children }: Props) {
  return (
    <AppShell user={user} buzzBalance={buzzBalance}>
      {children}
    </AppShell>
  );
}
