import { closeDb } from './helpers/db';

/**
 * Close the shared pg pool opened by helpers/db.ts in the main process. The
 * test DB is intentionally NOT dropped or wiped here — a clean slate is
 * guaranteed at globalSetup instead (survives crashed runs, preserves rows
 * for post-mortem debugging).
 */
export default async function globalTeardown(): Promise<void> {
  await closeDb();
}
