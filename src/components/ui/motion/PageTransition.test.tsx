import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageTransition } from './PageTransition';

describe('PageTransition', () => {
  it('renders the current view children', () => {
    const html = renderToStaticMarkup(
      <PageTransition motionKey="/campaigns">view-content</PageTransition>,
    );
    expect(html).toContain('view-content');
  });
});
