import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedPrompt } from '@/lib/promptBuilder';

/* -------------------------------------------------------------------------- */
/* hoisted mocks                                                               */
/* -------------------------------------------------------------------------- */

const navigationMocks = vi.hoisted(() => {
  const search = new URLSearchParams();
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    search,
    router,
    setStep(step: string | null) {
      // clear and set fresh search params for the next render cycle
      const keys = Array.from(search.keys());
      for (const k of keys) search.delete(k);
      if (step) search.set('step', step);
    },
    useRouter: vi.fn(() => router),
    useSearchParams: vi.fn(() => search),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: navigationMocks.useRouter,
  useSearchParams: navigationMocks.useSearchParams,
}));

import {
  type Brief,
  buildCookPayload,
  buildPreviewPayload,
  isStep,
  PhotoshootWizard,
} from './PhotoshootWizard';

/* -------------------------------------------------------------------------- */
/* fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function makeBrief(over: Partial<Brief> = {}): Brief {
  return {
    productName: 'lumen serum',
    productNotes: '15ml amber dropper · turmeric + bakuchiol',
    ratio: '4:5',
    variantsPerTemplate: 2,
    templateIds: ['studio-clean', 'lifestyle-kitchen'],
    ...over,
  };
}

function makeEnhanced(over: Partial<EnhancedPrompt> = {}): EnhancedPrompt {
  return {
    base: 'product: lumen serum. matte amber dropper',
    brandLayer: 'brand: lumen. tone: warm. palette accents: amber, gold',
    styleLayer: 'studio product shot, seamless paper background',
    finalPrompt: 'product: lumen serum. brand: lumen. studio product shot',
    negativePrompt: 'low quality, watermark',
    aspectRatio: '4:5',
    ...over,
  };
}

/** Render the wizard with the now-required library props supplied empty. */
function renderWizard() {
  return renderToStaticMarkup(<PhotoshootWizard libraryAssets={[]} libraryProducts={[]} />);
}

/* -------------------------------------------------------------------------- */
/* isStep                                                                      */
/* -------------------------------------------------------------------------- */

describe('isStep', () => {
  it('accepts the three valid step values', () => {
    expect(isStep('configure')).toBe(true);
    expect(isStep('review')).toBe(true);
    expect(isStep('submit')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isStep(null)).toBe(false);
    expect(isStep(undefined)).toBe(false);
    expect(isStep('')).toBe(false);
    expect(isStep('brief')).toBe(false);
    expect(isStep('done')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* buildPreviewPayload                                                         */
/* -------------------------------------------------------------------------- */

describe('buildPreviewPayload', () => {
  it('threads through the brief, templateIds and references unchanged', () => {
    const brief = makeBrief();
    const payload = buildPreviewPayload(brief, ['product:p1', 'asset:a1']);
    expect(payload).toEqual({
      brief,
      templateIds: brief.templateIds,
      referenceAssetIds: ['product:p1', 'asset:a1'],
    });
  });

  it('forwards an empty references list verbatim', () => {
    const brief = makeBrief();
    const payload = buildPreviewPayload(brief, []);
    expect(payload.referenceAssetIds).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* buildCookPayload                                                            */
/* -------------------------------------------------------------------------- */

describe('buildCookPayload', () => {
  it('merges preview enhanced prompts into the cook body keyed by templateId', () => {
    const brief = makeBrief();
    const enhanced = {
      'studio-clean': makeEnhanced({ finalPrompt: 'studio clean prompt' }),
      'lifestyle-kitchen': makeEnhanced({ finalPrompt: 'kitchen prompt' }),
    };
    const payload = buildCookPayload(brief, [], enhanced, {}, 'My Shoot');
    expect(Object.keys(payload.enhancedPrompts)).toEqual(['studio-clean', 'lifestyle-kitchen']);
    expect(payload.enhancedPrompts['studio-clean']?.finalPrompt).toBe('studio clean prompt');
    expect(payload.enhancedPrompts['studio-clean']?.userOverride).toBeUndefined();
  });

  it('carries the free-text title through alongside the brief', () => {
    const brief = makeBrief();
    const payload = buildCookPayload(brief, [], {}, {}, 'Golden Hour Set');
    expect(payload.title).toBe('Golden Hour Set');
    // title is independent of the product name
    expect(payload.productName).toBe('lumen serum');
  });

  it('passes user overrides through as userOverride on the matching template only', () => {
    const brief = makeBrief();
    const enhanced = {
      'studio-clean': makeEnhanced(),
      'lifestyle-kitchen': makeEnhanced(),
    };
    const payload = buildCookPayload(
      brief,
      [],
      enhanced,
      { 'studio-clean': '  my custom prompt  ' },
      'My Shoot',
    );
    expect(payload.enhancedPrompts['studio-clean']?.userOverride).toBe('my custom prompt');
    expect(payload.enhancedPrompts['lifestyle-kitchen']?.userOverride).toBeUndefined();
  });

  it('drops empty/whitespace overrides — they should not silently overwrite the assembled prompt', () => {
    const brief = makeBrief();
    const enhanced = { 'studio-clean': makeEnhanced(), 'lifestyle-kitchen': makeEnhanced() };
    const payload = buildCookPayload(
      brief,
      [],
      enhanced,
      { 'studio-clean': '   ', 'lifestyle-kitchen': '' },
      'My Shoot',
    );
    expect(payload.enhancedPrompts['studio-clean']?.userOverride).toBeUndefined();
    expect(payload.enhancedPrompts['lifestyle-kitchen']?.userOverride).toBeUndefined();
  });

  it('skips templates that have no entry in the preview enhanced map', () => {
    const brief = makeBrief();
    const payload = buildCookPayload(
      brief,
      [],
      { 'studio-clean': makeEnhanced() }, // missing lifestyle-kitchen
      {},
      'My Shoot',
    );
    expect(Object.keys(payload.enhancedPrompts)).toEqual(['studio-clean']);
  });

  it('preserves referenceAssetIds + brief fields at the top level of the cook body', () => {
    const brief = makeBrief();
    const payload = buildCookPayload(brief, ['product:p1'], {}, {}, 'My Shoot');
    expect(payload.productName).toBe(brief.productName);
    expect(payload.productNotes).toBe(brief.productNotes);
    expect(payload.ratio).toBe(brief.ratio);
    expect(payload.variantsPerTemplate).toBe(brief.variantsPerTemplate);
    expect(payload.templateIds).toEqual(brief.templateIds);
    expect(payload.referenceAssetIds).toEqual(['product:p1']);
  });

  it('handles a missing preview gracefully (undefined enhancedFromPreview)', () => {
    const brief = makeBrief();
    const payload = buildCookPayload(brief, [], undefined, { 'studio-clean': 'x' }, 'My Shoot');
    expect(payload.enhancedPrompts).toEqual({});
  });
});

/* -------------------------------------------------------------------------- */
/* SSR step routing via search param                                           */
/* -------------------------------------------------------------------------- */

describe('PhotoshootWizard SSR step routing', () => {
  beforeEach(() => {
    navigationMocks.setStep(null);
    navigationMocks.router.replace.mockClear();
    navigationMocks.router.push.mockClear();
  });

  it('defaults to the configure step when no step query param is present', () => {
    navigationMocks.setStep(null);
    const html = renderWizard();
    expect(html).toContain('data-step="configure"');
    expect(html).toContain('data-testid="configure-step"');
    expect(html).not.toContain('data-testid="review-step"');
  });

  it('defaults to configure when step is something unknown', () => {
    navigationMocks.setStep('garbage');
    const html = renderWizard();
    expect(html).toContain('data-step="configure"');
  });

  it('renders the review step when ?step=review', () => {
    navigationMocks.setStep('review');
    const html = renderWizard();
    expect(html).toContain('data-step="review"');
    expect(html).toContain('data-testid="review-step"');
    expect(html).not.toContain('data-testid="configure-step"');
  });

  it('renders the submit step when ?step=submit', () => {
    navigationMocks.setStep('submit');
    const html = renderWizard();
    expect(html).toContain('data-step="submit"');
    expect(html).toContain('data-testid="submit-step"');
  });

  it('renders the name + prompt inputs inside the configure step', () => {
    navigationMocks.setStep('configure');
    const html = renderWizard();
    expect(html).toContain('data-testid="photoshoot-name"');
    expect(html).toContain('data-testid="photoshoot-prompt"');
  });

  it('renders the three-dot step indicator with aria-current on the active step', () => {
    navigationMocks.setStep('review');
    const html = renderWizard();
    expect(html).toContain('data-testid="step-dots"');
    expect(html).toContain('aria-current="step"');
  });
});

/* -------------------------------------------------------------------------- */
/* Review step renders per-template cards once preview lands                   */
/* -------------------------------------------------------------------------- */
/* The wizard's preview state is fetched on the client; in SSR it's null and  */
/* the cards render with empty enhanced data. We assert the per-template card */
/* anchors exist so we know the row count tracks brief.templateIds (the       */
/* recommended photoshoot templates seeded by default), then assert the       */
/* structural anchors that override/buzz/brand-disclose features hang off of. */

describe('PhotoshootWizard review step structure', () => {
  beforeEach(() => {
    navigationMocks.setStep('review');
  });

  it('renders one template-card per seeded template id', () => {
    const html = renderWizard();
    const cards = html.match(/data-testid="template-card"/g) ?? [];
    // recommendedTemplateIds() seeds 3 (studio-clean, lifestyle-handheld, hero-wide).
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a buzz pill per card and a single total at the top', () => {
    const html = renderWizard();
    expect(html).toContain('data-testid="total-buzz"');
    const perCard = html.match(/data-testid="template-buzz"/g) ?? [];
    expect(perCard.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes the brand-disclose toggle and an always-editable prompt textarea on every card', () => {
    const html = renderWizard();
    const brandToggles = html.match(/data-testid="brand-toggle"/g) ?? [];
    const textareas = html.match(/data-testid="override-textarea-/g) ?? [];
    // one brand toggle + one editable prompt textarea per card
    expect(brandToggles.length).toBe(textareas.length);
    expect(brandToggles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a Cook button anchored by data-testid', () => {
    const html = renderWizard();
    expect(html).toContain('data-testid="cook-button"');
    // initial total is 0 buzz before client-side preview lands
    expect(html).toContain('cook for 0 buzz');
  });
});

/* -------------------------------------------------------------------------- */
/* Preview + cook fetch wiring                                                 */
/* -------------------------------------------------------------------------- */
/* These tests verify that the helpers used by the wizard produce the exact   */
/* request bodies the server expects. We don't drive the component lifecycle  */
/* (no DOM in this vitest env), but the helpers are exported precisely so the */
/* wire format is locked.                                                      */

describe('PhotoshootWizard fetch wiring (via exported helpers)', () => {
  it('preview payload matches POST /api/photoshoot/preview schema', () => {
    const brief = makeBrief();
    const body = buildPreviewPayload(brief, ['product:p1']);
    // server expects: { brief, templateIds, referenceAssetIds }
    expect(Object.keys(body).sort()).toEqual(['brief', 'referenceAssetIds', 'templateIds']);
    expect(body.brief.productName).toBe('lumen serum');
    expect(body.templateIds).toContain('studio-clean');
  });

  it('cook payload puts brief + title at top level and references + enhancedPrompts alongside', () => {
    const brief = makeBrief();
    const enhanced = { 'studio-clean': makeEnhanced(), 'lifestyle-kitchen': makeEnhanced() };
    const body = buildCookPayload(
      brief,
      ['product:p1'],
      enhanced,
      { 'studio-clean': 'my override' },
      'Golden Hour Set',
    );
    // matches cook route schema (photoshootBriefSchema spread + title + extras)
    expect(body.productName).toBe(brief.productName);
    expect(body.title).toBe('Golden Hour Set');
    expect(body.templateIds).toEqual(brief.templateIds);
    expect(body.referenceAssetIds).toEqual(['product:p1']);
    expect(body.enhancedPrompts['studio-clean']?.userOverride).toBe('my override');
    expect(body.enhancedPrompts['lifestyle-kitchen']?.userOverride).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Override editing surface                                                     */
/* -------------------------------------------------------------------------- */
/* The review step's final-prompt textarea is always editable (no toggle).    */
/* We assert the textarea anchor renders per card and that a fresh override   */
/* produces a different cook payload — proof the override is the input the    */
/* debounced re-preview + the cook submission both observe.                   */

describe('override editing surface', () => {
  it('exposes a stable, always-rendered textarea anchor per template card on review', () => {
    navigationMocks.setStep('review');
    const html = renderWizard();
    expect(html).toContain('data-testid="override-textarea-studio-clean"');
  });

  it('an override mutates the cook payload deterministically', () => {
    const brief = makeBrief();
    const enhanced = { 'studio-clean': makeEnhanced({ finalPrompt: 'orig' }) };
    const without = buildCookPayload(brief, [], enhanced, {}, 'My Shoot');
    const withOverride = buildCookPayload(
      brief,
      [],
      enhanced,
      { 'studio-clean': 'edited' },
      'My Shoot',
    );
    expect(without.enhancedPrompts['studio-clean']?.userOverride).toBeUndefined();
    expect(withOverride.enhancedPrompts['studio-clean']?.userOverride).toBe('edited');
    expect(withOverride.enhancedPrompts['studio-clean']?.finalPrompt).toBe('orig'); // base preserved
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
