import { describe, expect, it } from 'vitest';
import {
  buildVitrineImageGenBody,
  VITRINE_CURRENCIES,
  withVitrineCurrencies,
} from './imageGenBody';

describe('VITRINE_CURRENCIES', () => {
  it('restricts spend to the green (SFW-only) Buzz pool', () => {
    expect(VITRINE_CURRENCIES).toEqual(['green']);
  });
});

describe('withVitrineCurrencies', () => {
  it('attaches currencies without dropping existing body fields', () => {
    const body = withVitrineCurrencies({ steps: [{ $type: 'imageGen' }], tags: ['x'] }) as Record<
      string,
      unknown
    >;
    expect(body.currencies).toEqual(['green']);
    expect(body.steps).toEqual([{ $type: 'imageGen' }]);
    expect(body.tags).toEqual(['x']);
  });
});

describe('buildVitrineImageGenBody', () => {
  it('pays the workflow from green Buzz', () => {
    const body = buildVitrineImageGenBody({
      prompt: 'a brand hero shot',
      aspectRatio: '1:1',
      numImages: 1,
    }) as Record<string, unknown>;
    expect(body.currencies).toEqual(['green']);
    expect(Array.isArray(body.steps)).toBe(true);
  });
});
