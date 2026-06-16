import { describe, expect, it } from 'vitest';

import type { CampaignTile } from '@/lib/campaigns';
import { groupTilesByCreative, slotsForTile } from './creativeGroups';

function tile(over: Partial<CampaignTile>): CampaignTile {
  return {
    id: 'id',
    presetId: 'ig-feed',
    workflowId: 'wf',
    status: 'done',
    prompt: 'p',
    quantity: 1,
    variantGroupId: null,
    variantIndex: 0,
    adCopy: null,
    palette: null,
    assetUrl: null,
    ...over,
  };
}

describe('groupTilesByCreative', () => {
  it('groups sibling tiles by variantGroupId, ordered by variantIndex', () => {
    const tiles = [
      tile({ id: 't1', variantGroupId: 'g1', variantIndex: 1 }),
      tile({ id: 't0', variantGroupId: 'g1', variantIndex: 0 }),
      tile({ id: 't2', variantGroupId: 'g1', variantIndex: 2 }),
    ];
    const groups = groupTilesByCreative(tiles);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('g1');
    expect(groups[0]!.presetId).toBe('ig-feed');
    expect(groups[0]!.tiles.map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  });

  it('treats a NULL-group (legacy) tile as its own group keyed by tile id', () => {
    const tiles = [tile({ id: 'legacy', variantGroupId: null, quantity: 4 })];
    const groups = groupTilesByCreative(tiles);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('legacy');
  });

  it('preserves first-appearance order across groups', () => {
    const tiles = [
      tile({ id: 'a', variantGroupId: 'gB', presetId: 'ig-story' }),
      tile({ id: 'b', variantGroupId: 'gA', presetId: 'ig-feed' }),
    ];
    const groups = groupTilesByCreative(tiles);
    expect(groups.map((g) => g.key)).toEqual(['gB', 'gA']);
  });
});

describe('slotsForTile', () => {
  it('returns 1 for a grouped (new) variant tile regardless of loaded urls', () => {
    expect(slotsForTile(tile({ variantGroupId: 'g1', quantity: 1 }), 0)).toBe(1);
    expect(slotsForTile(tile({ variantGroupId: 'g1', quantity: 1 }), 1)).toBe(1);
  });

  it('returns quantity for a legacy tile before urls arrive', () => {
    expect(slotsForTile(tile({ variantGroupId: null, quantity: 4 }), 0)).toBe(4);
  });

  it('expands to the loaded url count when it exceeds quantity (legacy)', () => {
    expect(slotsForTile(tile({ variantGroupId: null, quantity: 1 }), 3)).toBe(3);
  });
});
