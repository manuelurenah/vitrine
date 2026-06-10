import { describe, expect, it } from 'vitest';
import { buildCampaignNewHref, buildPhotoshootNewHref } from './campaignHref';

describe('buildCampaignNewHref', () => {
  it('encodes a single legacy asset id', () => {
    expect(buildCampaignNewHref(['a1'])).toBe('/campaigns/new?refs=asset%3Aa1');
  });

  it('comma-joins multiple legacy asset ids before encoding', () => {
    expect(buildCampaignNewHref(['a1', 'a2'])).toBe('/campaigns/new?refs=asset%3Aa1%2Casset%3Aa2');
  });

  it('handles a mixed CampaignRef[] of assets and products', () => {
    expect(
      buildCampaignNewHref([
        { kind: 'asset', id: 'a1' },
        { kind: 'product', id: 'p1' },
      ]),
    ).toBe('/campaigns/new?refs=asset%3Aa1%2Cproduct%3Ap1');
  });

  it('returns a trailing-empty refs query when no refs are supplied', () => {
    expect(buildCampaignNewHref([])).toBe('/campaigns/new?refs=');
  });
});

describe('buildPhotoshootNewHref', () => {
  it('encodes an asset subject', () => {
    expect(buildPhotoshootNewHref({ kind: 'asset', id: 'a1' })).toBe(
      '/photoshoot/new?subject=asset%3Aa1',
    );
  });

  it('encodes a product subject', () => {
    expect(buildPhotoshootNewHref({ kind: 'product', id: 'p1' })).toBe(
      '/photoshoot/new?subject=product%3Ap1',
    );
  });
});
