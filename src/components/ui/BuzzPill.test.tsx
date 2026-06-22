import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BuzzPill } from './BuzzPill';

describe('BuzzPill', () => {
  it('renders the formatted amount', () => {
    const html = renderToStaticMarkup(<BuzzPill amount={12500} />);
    expect(html).toContain('12,500');
  });

  it('keeps the pill base classes', () => {
    const html = renderToStaticMarkup(<BuzzPill amount={1} />);
    expect(html).toContain('rounded-pill');
  });
});
