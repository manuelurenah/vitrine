import { beforeEach, describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- *
 * In-memory fixtures
 * -------------------------------------------------------------------------- */

type VersionRow = {
  id: string;
  version: number;
  workflowId: string;
  prompt: string;
  adCopy: unknown;
  assetId: string | null;
  changeNote: string | null;
  generationId: string | null;
  createdAt: Date;
};

type AssetRow = {
  workflowId: string | null;
  storageKey: string;
  publicUrl: string | null;
  deletedAt: Date | null;
};

const fixtures = {
  versions: [] as VersionRow[],
  assets: [] as AssetRow[],
};

/* -------------------------------------------------------------------------- *
 * Mock drizzle-orm: predicate helpers are no-ops here because the mocked db
 * resolves from fixtures directly based on the queried table.
 * -------------------------------------------------------------------------- */

vi.mock('drizzle-orm', () => ({
  and: () => undefined,
  asc: () => undefined,
  desc: () => undefined,
  eq: () => undefined,
  inArray: () => undefined,
  isNull: () => undefined,
  max: () => undefined,
}));

/* -------------------------------------------------------------------------- *
 * Mock the schema so the mocked db can identify which table a chain targets.
 * Each table gets a sentinel id field we sniff in `tableOf`.
 * -------------------------------------------------------------------------- */

vi.mock('@/lib/db/schema', () => ({
  tileVersions: { __table: 'tileVersions' },
  campaignTiles: { __table: 'campaignTiles' },
  campaigns: { __table: 'campaigns' },
  assets: {
    __table: 'assets',
    workflowId: 'assets.workflowId',
    storageKey: 'assets.storageKey',
    publicUrl: 'assets.publicUrl',
  },
}));

type Table = 'tileVersions' | 'assets';

function tableOf(token: unknown): Table {
  const t = token as { __table?: string };
  if (t?.__table === 'tileVersions') return 'tileVersions';
  if (t?.__table === 'assets') return 'assets';
  throw new Error('unknown table token in mock: ' + JSON.stringify(token));
}

/* -------------------------------------------------------------------------- *
 * Mock the drizzle db. Chains we need to handle:
 *   db.select({...}).from(tileVersions).innerJoin().innerJoin().where().orderBy()
 *   db.select({...}).from(assets).where().orderBy()
 * Each resolves to fixture rows by table.
 * -------------------------------------------------------------------------- */

function buildSelect() {
  let table: Table | null = null;
  const chain = {
    from(t: unknown) {
      table = tableOf(t);
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    then(onResolve: (rows: unknown[]) => unknown) {
      let rows: unknown[] = [];
      if (table === 'tileVersions') {
        rows = fixtures.versions
          .slice()
          .sort((a, b) => a.version - b.version)
          .map((r) => ({
            id: r.id,
            version: r.version,
            workflowId: r.workflowId,
            prompt: r.prompt,
            adCopy: r.adCopy,
            assetId: r.assetId,
            changeNote: r.changeNote,
            generationId: r.generationId,
            createdAt: r.createdAt,
          }));
      } else if (table === 'assets') {
        rows = fixtures.assets
          .filter((a) => a.deletedAt === null)
          .slice()
          .sort((a, b) => a.storageKey.localeCompare(b.storageKey))
          .map((a) => ({
            workflowId: a.workflowId,
            storageKey: a.storageKey,
            publicUrl: a.publicUrl,
          }));
      }
      return Promise.resolve(rows).then(onResolve);
    },
  };
  return chain;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => buildSelect(),
  },
}));

import { diffTileVersions, listTileVersions, type TileVersionSnapshot } from './tileVersions';

/* -------------------------------------------------------------------------- *
 * Seed helpers
 * -------------------------------------------------------------------------- */

function seedVersion(over: Partial<VersionRow> & Pick<VersionRow, 'version' | 'workflowId'>) {
  fixtures.versions.push({
    id: `v${over.version}`,
    prompt: 'a product on a table',
    adCopy: null,
    assetId: null,
    changeNote: null,
    generationId: null,
    createdAt: new Date(0),
    ...over,
  });
}

function seedAsset(over: Partial<AssetRow> & Pick<AssetRow, 'workflowId' | 'storageKey'>) {
  fixtures.assets.push({
    publicUrl: null,
    deletedAt: null,
    ...over,
  });
}

beforeEach(() => {
  fixtures.versions.length = 0;
  fixtures.assets.length = 0;
});

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

const v = (over: Partial<TileVersionSnapshot>): TileVersionSnapshot => ({
  version: 1,
  prompt: 'a product on a table',
  adCopy: { headline: 'old head', subhead: 'old sub', cta: 'shop now' },
  ...over,
});

describe('diffTileVersions', () => {
  it('marks changed adCopy fields with old/new and unchanged otherwise', () => {
    const diff = diffTileVersions(
      v({ version: 1 }),
      v({ version: 2, adCopy: { headline: 'new head', subhead: 'old sub', cta: 'buy' } }),
    );
    expect(diff.find((d) => d.field === 'headline')).toEqual({
      field: 'headline',
      changed: true,
      old: 'old head',
      next: 'new head',
    });
    expect(diff.find((d) => d.field === 'subhead')).toEqual({
      field: 'subhead',
      changed: false,
      old: 'old sub',
      next: 'old sub',
    });
    expect(diff.find((d) => d.field === 'cta')).toEqual({
      field: 'cta',
      changed: true,
      old: 'shop now',
      next: 'buy',
    });
  });
  it('detects prompt change', () => {
    const diff = diffTileVersions(v({}), v({ version: 2, prompt: 'a product on marble' }));
    expect(diff.find((d) => d.field === 'prompt')?.changed).toBe(true);
  });
});

describe('listTileVersions — per-version asset url resolution', () => {
  it('resolves each version to its workflow image, sharing across same workflowId', async () => {
    seedAsset({ workflowId: 'w1', storageKey: 'w1/0', publicUrl: 'https://img/a' });
    seedVersion({ version: 1, workflowId: 'w1' });
    seedVersion({ version: 2, workflowId: 'w1' });
    seedVersion({ version: 3, workflowId: 'w2' });

    const entries = await listTileVersions('u1', 'c1', 't1');

    expect(entries.map((e) => e.version)).toEqual([1, 2, 3]);
    // Versions 1 and 2 share workflow w1, so both get its image.
    expect(entries[0]!.assetUrl).toBe('https://img/a');
    expect(entries[1]!.assetUrl).toBe('https://img/a');
    // Version 3 (workflow w2) has no asset → null.
    expect(entries[2]!.assetUrl).toBeNull();
  });

  it('picks index 0 (lowest storageKey) when a workflow has multiple assets', async () => {
    // Seeded out of order; resolution should still pick `w1/0`.
    seedAsset({ workflowId: 'w1', storageKey: 'w1/2', publicUrl: 'https://img/two' });
    seedAsset({ workflowId: 'w1', storageKey: 'w1/0', publicUrl: 'https://img/zero' });
    seedVersion({ version: 1, workflowId: 'w1' });

    const entries = await listTileVersions('u1', 'c1', 't1');

    expect(entries[0]!.assetUrl).toBe('https://img/zero');
  });

  it('ignores soft-deleted assets', async () => {
    seedAsset({
      workflowId: 'w1',
      storageKey: 'w1/0',
      publicUrl: 'https://img/gone',
      deletedAt: new Date(),
    });
    seedVersion({ version: 1, workflowId: 'w1' });

    const entries = await listTileVersions('u1', 'c1', 't1');

    expect(entries[0]!.assetUrl).toBeNull();
  });
});
