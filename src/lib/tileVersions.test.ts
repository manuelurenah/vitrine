import { describe, expect, it, vi } from 'vitest';

// Mock the DB so this pure-function test runs without a real Postgres
// connection or env variables being set.
vi.mock('@/lib/db', () => ({ db: {} }));

import { diffTileVersions, type TileVersionSnapshot } from './tileVersions';

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
