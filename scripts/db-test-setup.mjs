#!/usr/bin/env node
/**
 * Idempotent test-database bootstrap.
 *   1. Connect to the cluster (using DATABASE_URL or PG defaults).
 *   2. CREATE DATABASE vitrine_test if missing.
 *   3. Run drizzle-kit migrate against that database.
 *
 * Run with: `pnpm test:db:setup`
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const TEST_DB = process.env.TEST_DATABASE_NAME ?? 'vitrine_test';
const SOURCE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/vitrine';

function targetUrl(name) {
  const u = new URL(SOURCE_URL);
  u.pathname = `/${name}`;
  return u.toString();
}

const TEST_URL = process.env.TEST_DATABASE_URL ?? targetUrl(TEST_DB);

async function ensureDatabase() {
  // Connect to the "postgres" maintenance db on the same cluster to issue
  // CREATE DATABASE — can't run inside a transaction so we use a tiny
  // single-shot client.
  const adminUrl = (() => {
    const u = new URL(SOURCE_URL);
    u.pathname = '/postgres';
    return u.toString();
  })();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
    if (exists.rows.length === 0) {
      // Identifier is fixed (env-controlled) — avoid SQL injection by
      // restricting to ascii word chars.
      if (!/^[a-zA-Z0-9_]+$/.test(TEST_DB))
        throw new Error(`unsafe TEST_DATABASE_NAME: ${TEST_DB}`);
      await client.query(`CREATE DATABASE "${TEST_DB}"`);
      console.log(`[test-db] created ${TEST_DB}`);
    } else {
      console.log(`[test-db] ${TEST_DB} already exists`);
    }
  } finally {
    await client.end();
  }
}

function runMigrations() {
  const res = spawnSync(process.execPath, ['./node_modules/drizzle-kit/bin.cjs', 'migrate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_URL },
  });
  if (res.status !== 0) {
    console.error('[test-db] drizzle-kit migrate failed');
    process.exit(res.status ?? 1);
  }
  console.log(`[test-db] migrations applied to ${TEST_URL}`);
}

(async () => {
  await ensureDatabase();
  runMigrations();
})().catch((err) => {
  console.error('[test-db]', err);
  process.exit(1);
});
