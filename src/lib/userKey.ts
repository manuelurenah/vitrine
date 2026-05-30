import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getMe } from './civitai';
import type { Session } from './session';

/**
 * Resolve a stable user key for our persistent stores and ensure a `users` row
 * exists for it (so subsequent FK-bearing inserts succeed). The key is the
 * Civitai numeric id stringified when known, falling back to `u:<username>` or
 * `anon` for the single-tenant local-dev case.
 */
export async function getUserKey(session: Session): Promise<string> {
  let id: number | undefined = session.user?.id;
  let username: string | undefined = session.user?.username;

  if (id === undefined && username === undefined) {
    const me = await getMe(session);
    if (me.id) id = me.id;
    if (me.username) username = me.username;
    session.user = { ...session.user, id, username };
  }

  const key = id !== undefined ? String(id) : username ? `u:${username}` : 'anon';

  await db
    .insert(users)
    .values({
      id: key,
      civitaiId: id ?? null,
      username: username ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        civitaiId: id ?? sql`${users.civitaiId}`,
        username: username ?? sql`${users.username}`,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return key;
}
