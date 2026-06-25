import { describe, expect, it } from 'vitest';
import { mergeRefreshedTokens } from './session';

describe('mergeRefreshedTokens', () => {
  it('keeps the fresh refresh_token when present', () => {
    const out = mergeRefreshedTokens(
      { access_token: 'old', refresh_token: 'oldR', expires_at: 1 } as any,
      { access_token: 'new', refresh_token: 'newR', expires_at: 2 } as any,
    );
    expect(out.refresh_token).toBe('newR');
    expect(out.access_token).toBe('new');
  });
  it('carries the previous refresh_token forward when the refresh omits it', () => {
    const out = mergeRefreshedTokens(
      { access_token: 'old', refresh_token: 'oldR', expires_at: 1 } as any,
      { access_token: 'new', expires_at: 2 } as any,
    );
    expect(out.refresh_token).toBe('oldR');
    expect(out.access_token).toBe('new');
  });
});
