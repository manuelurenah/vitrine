import { describe, expect, it } from 'vitest';

import { pickCanvasImageUrl } from './CreativeEditor';

/* -------------------------------------------------------------------------- */
/* pickCanvasImageUrl — variant / version fallback selection                   */
/* -------------------------------------------------------------------------- */

const URLS = ['url-0', 'url-1', 'url-2'];

describe('pickCanvasImageUrl — latest version', () => {
  it('returns the selected variant when it exists', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: true,
        liveUrls: URLS,
        variantIndex: 2,
        versionAssetUrl: 'stored',
      }),
    ).toBe('url-2');
  });

  it('falls back to the first variant when the index is out of range', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: true,
        liveUrls: URLS,
        variantIndex: 9,
        versionAssetUrl: 'stored',
      }),
    ).toBe('url-0');
  });

  it('selects the first variant when index is 0', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: true,
        liveUrls: URLS,
        variantIndex: 0,
        versionAssetUrl: 'stored',
      }),
    ).toBe('url-0');
  });

  it('falls back to the stored asset when no live urls have arrived yet', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: true,
        liveUrls: [],
        variantIndex: 1,
        versionAssetUrl: 'stored',
      }),
    ).toBe('stored');
  });

  it('returns null when neither live urls nor a stored asset exist', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: true,
        liveUrls: [],
        variantIndex: 0,
        versionAssetUrl: null,
      }),
    ).toBeNull();
  });
});

describe('pickCanvasImageUrl — older version', () => {
  it('ignores the variant index and uses the stored asset', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: false,
        liveUrls: URLS,
        variantIndex: 2,
        versionAssetUrl: 'older-asset',
      }),
    ).toBe('older-asset');
  });

  it('returns null when an older version has no stored asset', () => {
    expect(
      pickCanvasImageUrl({
        isLatestVersion: false,
        liveUrls: URLS,
        variantIndex: 1,
        versionAssetUrl: null,
      }),
    ).toBeNull();
  });
});
