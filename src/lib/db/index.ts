import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '@/lib/env';
import * as schema from './schema';

function makePool(): Pool {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Run `pnpm dev:up` for the local Postgres container and ensure .env has DATABASE_URL.',
    );
  }
  return new Pool({ connectionString: env.DATABASE_URL, max: 10 });
}

const globalForPool = globalThis as unknown as { __vitrinePgPool?: Pool };

const pool = globalForPool.__vitrinePgPool ?? makePool();
if (process.env.NODE_ENV !== 'production') globalForPool.__vitrinePgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
export type Db = typeof db;
