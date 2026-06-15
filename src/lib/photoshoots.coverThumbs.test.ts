import { describe, expect, it, vi } from 'vitest';

/* -------------------------------------------------------------------------- */
/* mocks — photoshoots.ts pulls in drizzle/db/env; stub them out so the pure  */
/* pickCoverThumbs helper can be tested without a real database.               */
/* -------------------------------------------------------------------------- */

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/db/schema', () => ({}));
vi.mock('@civitai/app-sdk/orchestrator', () => ({
  extractImageUrls: vi.fn(() => []),
}));

import { pickCoverThumbs } from './photoshoots';

describe('pickCoverThumbs', () => {
  it('takes up to 4 images from a single shot', () => {
    expect(pickCoverThumbs([['a', 'b', 'c', 'd', 'e']])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('round-robins one image per shot across many shots', () => {
    const out = pickCoverThumbs([
      ['s1a', 's1b', 's1c'],
      ['s2a', 's2b', 's2c'],
      ['s3a', 's3b', 's3c'],
      ['s4a', 's4b', 's4c'],
    ]);
    expect(out).toEqual(['s1a', 's2a', 's3a', 's4a']);
  });

  it('fills remaining slots with later images when shots are few', () => {
    expect(pickCoverThumbs([['a1', 'a2'], ['b1']])).toEqual(['a1', 'b1', 'a2']);
  });

  it('skips empty shots and returns fewer than 4 when exhausted', () => {
    expect(pickCoverThumbs([[], ['b1'], []])).toEqual(['b1']);
  });
});
