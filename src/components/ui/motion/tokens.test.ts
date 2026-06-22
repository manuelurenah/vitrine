import { describe, expect, it } from 'vitest';
import { fadeUp, motionTokens, scaleIn } from './tokens';

describe('motionTokens', () => {
  it('exposes the three intensity tiers', () => {
    expect(Object.keys(motionTokens).sort()).toEqual(['feedback', 'hero', 'transition']);
  });

  it('feedback is faster than transition', () => {
    expect(motionTokens.feedback.duration).toBeLessThan(motionTokens.transition.duration);
  });

  it('hero is a spring', () => {
    expect(motionTokens.hero.type).toBe('spring');
  });

  it('fadeUp animates opacity and y, hidden→show', () => {
    expect(fadeUp.hidden).toEqual({ opacity: 0, y: 8 });
    expect(fadeUp.show).toEqual({ opacity: 1, y: 0 });
  });

  it('scaleIn animates opacity and scale', () => {
    expect(scaleIn.hidden.opacity).toBe(0);
    expect(scaleIn.hidden.scale).toBeLessThan(1);
    expect(scaleIn.show.scale).toBe(1);
  });
});
