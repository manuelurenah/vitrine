/**
 * Test-only DB helpers. Uses the same DATABASE_URL the app reads, hits
 * Postgres directly via `pg` (no drizzle / next runtime so it's usable from
 * Playwright workers).
 *
 * The test user id is derived from TEST_USER_ID (matches global-setup.ts)
 * and is the same key shape getUserKey() writes: `String(civitaiId)`.
 */

import { Pool } from 'pg';

import type { PhotoshootTemplateId } from '../../src/lib/photoshootTemplates';

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

/**
 * Insert an `assets` row directly. Mirrors what `createAsset()` /
 * `syncAssetsFromSnapshot()` would do post-orchestrator, but skips all the
 * SDK + S3 plumbing. Returns the new asset id.
 */
export type SeedAssetInput = {
  kind?: 'upload' | 'generated' | 'reference';
  collection?: string | null;
  publicUrl?: string;
  storageKey?: string;
  contentType?: string;
};

export async function seedAsset(
  input: SeedAssetInput = {},
  userId: string = TEST_USER_ID,
): Promise<string> {
  const pool = getPool();
  const kind = input.kind ?? 'upload';
  const storageKey =
    input.storageKey ?? `e2e/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const publicUrl = input.publicUrl ?? `http://stub.invalid/assets/${storageKey}`;
  const contentType = input.contentType ?? 'image/png';
  const metadata =
    typeof input.collection === 'string' && input.collection.length > 0
      ? JSON.stringify({ collection: input.collection })
      : '{}';
  const res = await pool.query<{ id: string }>(
    `INSERT INTO assets
       (user_id, kind, bucket, storage_key, public_url, content_type, metadata)
     VALUES ($1, $2::asset_kind, 'assets', $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [userId, kind, storageKey, publicUrl, contentType, metadata],
  );
  return res.rows[0]!.id;
}

/**
 * Insert a `products` row directly with an optional hero asset link. If
 * `heroAssetId` is provided, the matching `product_assets` row is also
 * created with `role='hero'`. Returns the new product id.
 */
export async function seedProduct(
  input: { name?: string; heroAssetId?: string | null } = {},
  userId: string = TEST_USER_ID,
): Promise<string> {
  const pool = getPool();
  const name = input.name ?? `e2e product ${Date.now()}`;
  const heroAssetId = input.heroAssetId ?? null;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO products (user_id, name, hero_asset_id, status)
     VALUES ($1, $2, $3, 'live')
     RETURNING id`,
    [userId, name, heroAssetId],
  );
  const productId = res.rows[0]!.id;
  if (heroAssetId) {
    await pool.query(
      `INSERT INTO product_assets (product_id, asset_id, role, position)
       VALUES ($1, $2, 'hero', 0)
       ON CONFLICT DO NOTHING`,
      [productId, heroAssetId],
    );
  }
  return productId;
}

/**
 * Seed a photoshoot with N tiles already in `done` status, each linked to a
 * freshly-seeded `generated` asset. Returns the photoshoot id and tile/asset
 * ids in insertion order. Mirrors the post-`syncAssetsFromSnapshot` state.
 */
export async function seedDonePhotoshoot(
  input: {
    tileCount?: number;
    title?: string;
    ratio?: string;
    templateId?: PhotoshootTemplateId;
  } = {},
  userId: string = TEST_USER_ID,
): Promise<{ id: string; tileIds: string[]; assetIds: string[] }> {
  const pool = getPool();
  const tileCount = Math.max(1, input.tileCount ?? 2);
  const title = input.title ?? `e2e shoot ${Date.now()}`;
  const ratio = input.ratio ?? '4:5';
  const templateId: PhotoshootTemplateId = input.templateId ?? 'studio-clean';

  const shootRes = await pool.query<{ id: string }>(
    `INSERT INTO photoshoots
       (user_id, title, brief, ratio, variants_per_template, template_ids,
        reference_asset_ids, estimated_buzz, actual_buzz)
     VALUES ($1, $2, $3::jsonb, $4, 1, ARRAY[$5]::text[],
             ARRAY[]::text[], 0, 0)
     RETURNING id`,
    [
      userId,
      title,
      JSON.stringify({ productNotes: 'e2e photoshoot', ratio, templates: [templateId] }),
      templateId,
    ],
  );
  const photoshootId = shootRes.rows[0]!.id;

  const tileIds: string[] = [];
  const assetIds: string[] = [];
  for (let i = 0; i < tileCount; i++) {
    const assetId = await seedAsset({ kind: 'generated' }, userId);
    assetIds.push(assetId);
    const workflowId = `e2e-wf-${photoshootId}-${i}`;
    const tileRes = await pool.query<{ id: string }>(
      `INSERT INTO photoshoot_tiles
         (photoshoot_id, template_id, variant_index, workflow_id, prompt,
          status, asset_id, quantity, estimated_buzz, actual_buzz)
       VALUES ($1, $2, $3, $4, $5, 'done'::tile_status, $6, 1, 0, 0)
       RETURNING id`,
      [photoshootId, templateId, i, workflowId, `e2e tile prompt ${i}`, assetId],
    );
    tileIds.push(tileRes.rows[0]!.id);
  }

  return { id: photoshootId, tileIds, assetIds };
}

export async function getProductAssetIds(productId: string): Promise<string[]> {
  const pool = getPool();
  const res = await pool.query<{ asset_id: string }>(
    `SELECT asset_id FROM product_assets WHERE product_id = $1 ORDER BY position ASC`,
    [productId],
  );
  return res.rows.map((r) => r.asset_id);
}

export async function getAssetCollection(assetId: string): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query<{ collection: string | null }>(
    `SELECT metadata->>'collection' AS collection FROM assets WHERE id = $1`,
    [assetId],
  );
  return res.rows[0]?.collection ?? null;
}

export type SeedCampaignInput = {
  title?: string;
  presetId?: string;
  adCopy?: { headline: string; subhead: string; cta?: string };
  prompt?: string;
  versions?: number;
};

/**
 * Seed a campaign with one tile already in `done` status, linked to a freshly-
 * seeded `generated` asset, and N `tile_versions` rows. Mirrors the
 * post-cook/post-regenerate state. Returns the campaign id, tile id, asset id,
 * and the number of versions inserted.
 */
export async function seedDoneCampaign(
  input: SeedCampaignInput = {},
  userId: string = TEST_USER_ID,
): Promise<{ id: string; tileId: string; assetId: string; versionCount: number }> {
  const pool = getPool();
  const title = input.title ?? 'e2e campaign';
  const presetId = input.presetId ?? 'ig-feed';
  const prompt = input.prompt ?? 'a product on a table';
  const adCopy = input.adCopy ?? { headline: 'old head', subhead: 'old sub', cta: 'shop now' };
  const versionCount = input.versions ?? 1;

  // Ensure the users row exists (same pattern as markOnboardingComplete).
  await pool.query(
    `INSERT INTO users (id, civitai_id, username, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [userId, Number.isFinite(Number(userId)) ? Number(userId) : null, null],
  );

  // Insert the campaign row.
  const campaignRes = await pool.query<{ id: string }>(
    `INSERT INTO campaigns
       (user_id, title, brief, preset_ids, estimated_buzz)
     VALUES ($1, $2, '{}'::jsonb, ARRAY[$3]::text[], 60)
     RETURNING id`,
    [userId, title, presetId],
  );
  const id = campaignRes.rows[0]!.id;

  // Seed a generated asset linked to this campaign tile.
  const rand = Math.random().toString(36).slice(2, 10);
  const storageKey = `e2e/generated/campaign-${id}-${rand}.png`;
  const publicUrl = `https://image.mock/seed/${rand}.png`;
  const assetRes = await pool.query<{ id: string }>(
    `INSERT INTO assets
       (user_id, kind, bucket, storage_key, public_url, content_type, metadata)
     VALUES ($1, 'generated'::asset_kind, 'assets', $2, $3, 'image/png', '{}'::jsonb)
     RETURNING id`,
    [userId, storageKey, publicUrl],
  );
  const assetId = assetRes.rows[0]!.id;

  // Insert the campaign tile.
  const workflowId = `mock-seed-${Math.random().toString(36).slice(2, 10)}`;
  const tileRes = await pool.query<{ id: string }>(
    `INSERT INTO campaign_tiles
       (campaign_id, preset_id, workflow_id, prompt, status, ad_copy, asset_id, estimated_buzz)
     VALUES ($1, $2, $3, $4, 'done'::tile_status, $5::jsonb, $6, 60)
     RETURNING id`,
    [id, presetId, workflowId, prompt, JSON.stringify(adCopy), assetId],
  );
  const tileId = tileRes.rows[0]!.id;

  // Insert tile_versions rows (version 1..N).
  for (let n = 1; n <= versionCount; n++) {
    const versionAdCopy = { headline: `head v${n}`, subhead: 'old sub', cta: 'shop now' };
    const changeNote = n === 1 ? 'cooked' : 'regenerated';
    await pool.query(
      `INSERT INTO tile_versions
         (tile_id, version, workflow_id, prompt, ad_copy, asset_id, change_note)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [tileId, n, workflowId, prompt, JSON.stringify(versionAdCopy), assetId, changeNote],
    );
  }

  return { id, tileId, assetId, versionCount };
}

/**
 * Count the number of tile_versions rows for a given tile.
 */
export async function countTileVersions(tileId: string): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM tile_versions WHERE tile_id = $1`,
    [tileId],
  );
  return res.rows[0]?.n ?? 0;
}

/**
 * Fetch the current status, prompt, and ad_copy for a campaign tile.
 * Returns null if the tile does not exist.
 */
export async function getTile(
  tileId: string,
): Promise<{ status: string; prompt: string; adCopy: unknown } | null> {
  const pool = getPool();
  const res = await pool.query<{ status: string; prompt: string; ad_copy: unknown }>(
    `SELECT status, prompt, ad_copy FROM campaign_tiles WHERE id = $1`,
    [tileId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { status: row.status, prompt: row.prompt, adCopy: row.ad_copy };
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.end();
    cached = null;
  }
}
