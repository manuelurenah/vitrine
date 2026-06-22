import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MotionNumber } from './MotionNumber';

describe('MotionNumber', () => {
  it('renders the formatted value on first paint (SSR)', () => {
    const html = renderToStaticMarkup(<MotionNumber value={1234} />);
    // Locale-formatted (thousands separator) value present for no-JS/SSR.
    expect(html).toContain('1,234');
  });
});
