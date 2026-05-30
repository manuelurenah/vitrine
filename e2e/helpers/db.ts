/**
 * Test-only DB helpers. Uses the same DATABASE_URL the app reads, hits
 * Postgres directly via `pg` (no drizzle / next runtime so it's usable from
 * Playwright workers).
 *
 * The test user id is derived from TEST_USER_ID (matches global-setup.ts)
 * and is the same key shape getUserKey() writes: `String(civitaiId)`.
 */

import { Pool } from 'pg';

const TEST_USER_ID = process.env.TEST_USER_ID ?? '1';

let cached: Pool | null = null;

function getPool(): Pool {
  if (cached) return cached;
  // Prefer the isolated test database; fall back to DATABASE_URL only if the
  // caller hasn't set TEST_DATABASE_URL (e.g. running a single spec manually
  // against a hand-cleaned dev db).
  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for e2e db helpers.');
  }
  cached = new Pool({ connectionString, max: 4 });
  return cached;
}

export const testUserId = TEST_USER_ID;

/**
 * Wipe everything we own for the test user — cascade FKs handle tiles,
 * product_assets, generations, etc. Leaves the `users` row alone so the
 * upsert in getUserKey is exercised on every spec run too.
 */
export async function resetUserData(userId: string = TEST_USER_ID): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Order matters even with cascade, since some FKs are SET NULL.
    await client.query('DELETE FROM campaigns WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM photoshoots WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM assets WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM products WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM brand_profiles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM generations WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM buzz_events WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM onboarding_state WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function markOnboardingComplete(userId: string = TEST_USER_ID): Promise<void> {
  const pool = getPool();
  // Ensure the users row exists so the FK on onboarding_state holds.
  await pool.query(
    `INSERT INTO users (id, civitai_id, username, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [userId, Number.isFinite(Number(userId)) ? Number(userId) : null, null],
  );
  await pool.query(
    `INSERT INTO onboarding_state (user_id, current_step, completed_at)
     VALUES ($1, 'next', now())
     ON CONFLICT (user_id)
       DO UPDATE SET current_step = 'next', completed_at = now(), updated_at = now()`,
    [userId],
  );
}

export async function countRows(table: string, userId: string = TEST_USER_ID): Promise<number> {
  const pool = getPool();
  const res = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [
    userId,
  ]);
  return res.rows[0]?.n ?? 0;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.end();
    cached = null;
  }
}
