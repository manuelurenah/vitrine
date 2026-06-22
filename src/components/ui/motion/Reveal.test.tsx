import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FadeIn, Reveal } from './Reveal';
import { Stagger } from './Stagger';

describe('Reveal / FadeIn', () => {
  it('renders its children (SSR markup passthrough)', () => {
    const html = renderToStaticMarkup(<Reveal>hello-reveal</Reveal>);
    expect(html).toContain('hello-reveal');
  });

  it('applies a passed className to the wrapper', () => {
    const html = renderToStaticMarkup(<FadeIn className="probe-class">x</FadeIn>);
    expect(html).toContain('probe-class');
  });
});

describe('Stagger', () => {
  it('renders all children in order', () => {
    const html = renderToStaticMarkup(
      <Stagger>
        <Reveal>one</Reveal>
        <Reveal>two</Reveal>
      </Stagger>,
    );
    expect(html.indexOf('one')).toBeGreaterThan(-1);
    expect(html.indexOf('two')).toBeGreaterThan(html.indexOf('one'));
  });
});
