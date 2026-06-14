import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InlineEditText } from './InlineEditText';

const noop = async () => {};

describe('InlineEditText (display state)', () => {
  it('renders the current value', () => {
    const html = renderToStaticMarkup(
      <InlineEditText value="Hello world" ariaLabel="edit title" onSave={noop} />,
    );
    expect(html).toContain('Hello world');
    expect(html).toContain('aria-label="edit title"');
  });

  it('renders the placeholder when the value is empty', () => {
    const html = renderToStaticMarkup(
      <InlineEditText
        value=""
        placeholder="Add a description"
        ariaLabel="edit description"
        onSave={noop}
      />,
    );
    expect(html).toContain('Add a description');
  });

  it('renders a button so the text is keyboard-focusable', () => {
    const html = renderToStaticMarkup(
      <InlineEditText value="Title" ariaLabel="edit title" onSave={noop} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
  });
});
