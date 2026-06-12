import { describe, expect, it } from 'vitest';
import { BRIEFS } from './fixtures';

describe('BRIEFS fixtures', () => {
  it('has at least two briefs', () => {
    expect(Object.keys(BRIEFS).length).toBeGreaterThanOrEqual(2);
  });

  it('every brief is complete enough to drive the prompt builder', () => {
    for (const [key, f] of Object.entries(BRIEFS)) {
      expect(key, 'fixture key').not.toBe('');
      for (const field of ['title', 'description', 'goal', 'offer', 'prompt'] as const) {
        expect(f.brief[field], `${key}.brief.${field}`).toBeTruthy();
      }
      expect(f.brand.name, `${key}.brand.name`).toBeTruthy();
      expect(f.adCopy.headline, `${key}.adCopy.headline`).toBeTruthy();
      expect(f.adCopy.subhead, `${key}.adCopy.subhead`).toBeTruthy();
    }
  });
});
