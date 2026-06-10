import { describe, expect, it } from 'vitest';
import { mergeImageAssetIds } from './AddProductForm';

/* -------------------------------------------------------------------------- */
/* mergeImageAssetIds                                                          */
/* -------------------------------------------------------------------------- */
//
// The helper merges two sources of asset ids (newly-uploaded + library-picked),
// preserving the order "uploads first, library after", deduplicates, and caps
// the result at MAX_IMAGES (default 8). Nullish / empty-string entries are
// silently dropped so callers can pass partially-resolved upload arrays
// directly. These tests pin those guarantees because the helper is on the
// happy path for product creation (Task 5 cross-flow).

describe('mergeImageAssetIds', () => {
  it('drops null, undefined, and empty string entries from uploads', () => {
    const result = mergeImageAssetIds(['a1', null, undefined, '', 'a2'], []);
    expect(result).toEqual(['a1', 'a2']);
  });

  it('dedupes within the uploads array', () => {
    const result = mergeImageAssetIds(['a1', 'a1', 'a2', 'a2', 'a3'], []);
    expect(result).toEqual(['a1', 'a2', 'a3']);
  });

  it('dedupes within the library array', () => {
    const result = mergeImageAssetIds([], ['b1', 'b1', 'b2', 'b2']);
    expect(result).toEqual(['b1', 'b2']);
  });

  it('dedupes across uploads + library with uploads-first ordering winning', () => {
    // Same id present in both arrays — uploads-first wins so the id keeps its
    // position from the uploads array, the library copy is dropped.
    const result = mergeImageAssetIds(['a1', 'shared', 'a2'], ['shared', 'b1']);
    expect(result).toEqual(['a1', 'shared', 'a2', 'b1']);
  });

  it('preserves the upload-before-library order even when there is no overlap', () => {
    const result = mergeImageAssetIds(['u1', 'u2'], ['l1', 'l2']);
    expect(result).toEqual(['u1', 'u2', 'l1', 'l2']);
  });

  it('caps the merged result at MAX_IMAGES (default 8)', () => {
    const uploads = ['u1', 'u2', 'u3', 'u4', 'u5'];
    const library = ['l1', 'l2', 'l3', 'l4', 'l5'];
    const result = mergeImageAssetIds(uploads, library);
    expect(result).toHaveLength(8);
    // uploads come first, then library fills until cap
    expect(result).toEqual(['u1', 'u2', 'u3', 'u4', 'u5', 'l1', 'l2', 'l3']);
  });

  it('honors a custom cap', () => {
    const result = mergeImageAssetIds(['u1', 'u2', 'u3'], ['l1', 'l2'], 3);
    expect(result).toEqual(['u1', 'u2', 'u3']);
  });
});
