import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresetGrid } from './PresetGrid';

function countPressed(html: string): number {
  return (html.match(/aria-pressed="true"/g) ?? []).length;
}

describe('PresetGrid', () => {
  it('falls back to its default selection when uncontrolled', () => {
    const html = renderToStaticMarkup(<PresetGrid />);
    // Three presets are defaultOn: ig-feed, ig-story, li.
    expect(countPressed(html)).toBe(3);
  });

  it('reflects a controlled value exactly', () => {
    const html = renderToStaticMarkup(<PresetGrid value={['ig-feed', 'li']} />);
    expect(countPressed(html)).toBe(2);
  });

  it('shows nothing selected for an empty controlled value', () => {
    const html = renderToStaticMarkup(<PresetGrid value={[]} />);
    expect(countPressed(html)).toBe(0);
  });
});
