import { PhotoshootWizard } from '@/components/photoshoot/PhotoshootWizard';
import { getSession } from '@/lib/session';
import { getBuzzAccount } from '@/lib/civitai';

export const metadata = { title: 'new photoshoot · vitrine' };
export const dynamic = 'force-dynamic';

export default async function NewPhotoshootPage() {
  const session = await getSession();
  const buzz = session
    ? await getBuzzAccount(session).catch(() => null)
    : null;
  return <PhotoshootWizard buzzBalance={buzz?.balance ?? null} />;
}
