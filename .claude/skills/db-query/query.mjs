#!/usr/bin/env node

/**
 * vitrine db-query — ad-hoc PostgreSQL runner for the local dev database.
 *
 * Reads DATABASE_URL from the project-root .env (the secret never lives in
 * this script). Read-only by default; write operations require --writable.
 *
 * Usage:
 *   node .claude/skills/db-query/query.mjs "SELECT count(*) FROM users"
 *   node .claude/skills/db-query/query.mjs --explain "SELECT * FROM campaigns WHERE id = 1"
 *   node .claude/skills/db-query/query.mjs --json "SELECT id, username FROM users LIMIT 3"
 *   node .claude/skills/db-query/query.mjs -f query.sql
 *   node .claude/skills/db-query/query.mjs --writable "UPDATE ..."   (requires explicit flag)
 *
 * Options:
 *   --explain       Run EXPLAIN ANALYZE on the query
 *   --writable      Allow write operations (INSERT/UPDATE/DELETE/...)
 *   --timeout <s>   Statement timeout in seconds (default: 30)
 *   --file, -f      Read query from a file
 *   --json          Output results as JSON
 *   --quiet, -q     Only output results, no headers
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// .claude/skills/db-query/query.mjs -> project root is three levels up.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '../../..');

// Load DATABASE_URL from the project-root .env without clobbering real env vars
// (CI / shell exports win, so secrets injected at runtime are respected).
function loadEnv() {
  const envPath = resolve(projectRoot, '.env');
  let content;
  try {
    content = readFileSync(envPath, 'utf-8');
  } catch {
    return; // no .env — rely on whatever is already in process.env
  }
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const DEFAULT_TIMEOUT_SECONDS = 30;
const WRITE_OPS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
  'CREATE', 'GRANT', 'REVOKE', 'COPY', 'MERGE',
];

// Parse arguments.
const args = process.argv.slice(2);
let query = '';
let explain = false;
let writable = false;
let jsonOutput = false;
let quiet = false;
let timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--explain') {
    explain = true;
  } else if (arg === '--writable') {
    writable = true;
  } else if (arg === '--json') {
    jsonOutput = true;
  } else if (arg === '--quiet' || arg === '-q') {
    quiet = true;
  } else if (arg === '--timeout' || arg === '-t') {
    const val = args[++i];
    if (!val || isNaN(parseInt(val, 10))) {
      console.error('Error: --timeout requires a number (seconds)');
      process.exit(1);
    }
    timeoutSeconds = parseInt(val, 10);
  } else if (arg === '--file' || arg === '-f') {
    const filePath = args[++i];
    if (!filePath) {
      console.error('Error: --file requires a path argument');
      process.exit(1);
    }
    query = readFileSync(resolve(process.cwd(), filePath), 'utf-8');
  } else if (!arg.startsWith('-')) {
    query = arg;
  }
}

if (!query) {
  console.error(`Usage: node query.mjs [options] "SQL query"

Options:
  --explain       Run EXPLAIN ANALYZE on the query
  --writable      Allow write operations (INSERT/UPDATE/DELETE/...)
  --timeout <s>   Statement timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --file, -f      Read query from a file
  --json          Output results as JSON
  --quiet, -q     Minimal output

Examples:
  node query.mjs "SELECT count(*) FROM users"
  node query.mjs --explain "SELECT * FROM campaigns WHERE id = 1"
  node query.mjs -f my-query.sql`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL not set (checked process.env and project .env).');
  process.exit(1);
}

// Strip SQL comments so the write guard can't be fooled by a leading comment.
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/--[^\n]*/g, ' ');        // line comments
}

// Read-only guard: inspect the first keyword of every statement.
if (!writable) {
  const statements = stripComments(query).split(';');
  for (const stmt of statements) {
    const firstWord = stmt.trim().split(/\s+/)[0]?.toUpperCase();
    if (firstWord && WRITE_OPS.includes(firstWord)) {
      console.error(`Error: write operation detected (${firstWord}). Re-run with --writable to confirm.`);
      console.error('This modifies the database and requires explicit intent.');
      process.exit(1);
    }
  }
}

// SSL only for remote / sslmode=require. Local dev Postgres has no SSL, and
// forcing it makes the connection hang or fail — that is the whole reason this
// skill exists separate from the global postgres-query skill.
function needsSsl(connStr) {
  try {
    const u = new URL(connStr);
    const sslmode = u.searchParams.get('sslmode');
    if (sslmode === 'disable') return false;
    if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full') return true;
    const host = u.hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '::1');
  } catch {
    return false;
  }
}

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
    statement_timeout: timeoutSeconds * 1000,
    query_timeout: timeoutSeconds * 1000,
  });

  try {
    await client.connect();

    if (!quiet) {
      const mode = writable ? 'WRITABLE' : 'read-only';
      const dbName = (() => { try { return new URL(connectionString).pathname.slice(1); } catch { return '?'; } })();
      console.error(`Connected to "${dbName}" (${mode}, timeout: ${timeoutSeconds}s)\n`);
    }

    const finalQuery = explain ? `EXPLAIN ANALYZE ${query}` : query;
    const start = Date.now();
    const raw = await client.query(finalQuery);
    const elapsed = Date.now() - start;
    // Multi-statement queries return an array of results; show the last one.
    const result = Array.isArray(raw) ? raw[raw.length - 1] : raw;

    if (jsonOutput) {
      console.log(JSON.stringify({
        rows: result.rows,
        rowCount: result.rowCount,
        elapsed,
        fields: result.fields?.map((f) => f.name),
      }, null, 2));
    } else if (explain) {
      console.log(result.rows.map((r) => r['QUERY PLAN']).join('\n'));
      if (!quiet) console.error(`\nQuery time: ${elapsed}ms`);
    } else {
      if (!quiet && result.fields) {
        console.log('Columns:', result.fields.map((f) => f.name).join(', '));
        console.log('─'.repeat(60));
      }
      if (result.rows.length === 0) {
        console.log('(no rows returned)');
      } else {
        for (const row of result.rows) console.log(row);
      }
      if (!quiet) console.error(`\n${result.rowCount} row(s) in ${elapsed}ms`);
    }
  } catch (err) {
    if (err.message.includes('timeout') || err.message.includes('canceling statement')) {
      console.error(`Error: query timed out after ${timeoutSeconds}s. Use --timeout <seconds> to raise the limit.`);
    } else {
      console.error('Query error:', err.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
