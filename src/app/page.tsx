import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/login/LoginScreen';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';
import { getOnboarding } from '@/lib/onboarding';

type SearchParams = Promise<{ error?: string; notice?: string }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (session) {
    const userKey = await getUserKey(session);
    const onboarding = await getOnboarding(userKey);
    if (!onboarding.completedAt) {
      redirect(`/onboarding/${onboarding.currentStep}`);
    }
    redirect('/campaigns');
  }
  const params = await searchParams;
  return <LoginScreen error={params.error} notice={params.notice} />;
}
