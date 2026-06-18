import { describe, expect, it } from 'vitest';
import { isOwnedStorageKey } from './storageKey';

describe('isOwnedStorageKey', () => {
  it('accepts a key under the user own upload prefix', () => {
    expect(isOwnedStorageKey('42', '42/abc-123.png')).toBe(true);
  });

  it('accepts a server-mirrored generated key for the user', () => {
    expect(isOwnedStorageKey('42', 'generated/42/deadbeef.jpg')).toBe(true);
  });

  it('rejects a key under another user prefix (cross-tenant)', () => {
    expect(isOwnedStorageKey('42', '99/secret.png')).toBe(false);
  });

  it('rejects a generated key for another user', () => {
    expect(isOwnedStorageKey('42', 'generated/99/secret.png')).toBe(false);
  });

  it('rejects a key that merely contains the user id but is not prefixed', () => {
    expect(isOwnedStorageKey('42', '99/42/x.png')).toBe(false);
  });

  it('rejects empty key or empty user', () => {
    expect(isOwnedStorageKey('42', '')).toBe(false);
    expect(isOwnedStorageKey('', '42/x.png')).toBe(false);
  });

  it('handles username-style keys (u:name)', () => {
    expect(isOwnedStorageKey('u:alice', 'u:alice/x.png')).toBe(true);
    expect(isOwnedStorageKey('u:alice', 'u:bob/x.png')).toBe(false);
  });
});
