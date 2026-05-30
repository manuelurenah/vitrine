import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getBuzzAccount, getMe } from '@/lib/civitai';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getOnboarding } from '@/lib/onboarding';
import { shellUserFromMe } from '@/lib/user';
import { AppShellProvider } from './AppShellContext';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/');

  const userKey = await getUserKey(session);
  const onboarding = await getOnboarding(userKey);
  if (!onboarding.completedAt) {
    redirect(`/onboarding/${onboarding.currentStep}`);
  }

  let buzzBalance: number | undefined;
  let user;
  try {
    const [me, buzz] = await Promise.all([getMe(session), getBuzzAccount(session)]);
    buzzBalance = buzz?.balance;
    user = shellUserFromMe(me);
  } catch {
    user = shellUserFromMe(null);
  }

  return (
    <AppShellProvider buzzBalance={buzzBalance} user={user}>
      {children}
    </AppShellProvider>
  );
}
