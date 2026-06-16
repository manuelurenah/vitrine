import { NextResponse } from 'next/server';
import { deleteAccount } from '@/lib/account';
import { revokeSessionGrant } from '@/lib/civitai';
import { clearSession, getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userKey = await getUserKey(session);

  // Order matters: blobs + DB rows first, then revoke, then clear the cookie
  // last so a mid-flow throw leaves the user logged in and able to retry.
  const counts = await deleteAccount(userKey);
  await revokeSessionGrant(session);
  await clearSession();

  return NextResponse.json({ ok: true, ...counts });
}
