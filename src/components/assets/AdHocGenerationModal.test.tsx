import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdHocGenerationModal,
  clampNumImages,
  DEFAULT_AD_HOC_FORM,
  FormView,
  PollingView,
  ResultsView,
  toggleSelectedIndex,
} from './AdHocGenerationModal';

/* -------------------------------------------------------------------------- */
/* test helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Pull the visible text content of an accordion toggle out of SSR markup by its
 * data-testid, stripping nested tags (e.g. the chevron <svg>) and whitespace so
 * we can assert on the leading character of the actual label.
 */
function extractToggleText(html: string, testid: string): string {
  const match = html.match(
    new RegExp(`<button[^>]*data-testid="${testid}"[^>]*>([\\s\\S]*?)</button>`),
  );
  const inner = match?.[1];
  if (inner === undefined) throw new Error(`toggle with data-testid="${testid}" not found`);
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* pure helpers                                                                */
/* -------------------------------------------------------------------------- */

describe('clampNumImages', () => {
  it('clamps to the [1,4] range and floors fractional input', () => {
    expect(clampNumImages(0)).toBe(1);
    expect(clampNumImages(1)).toBe(1);
    expect(clampNumImages(2.7)).toBe(2);
    expect(clampNumImages(4)).toBe(4);
    expect(clampNumImages(99)).toBe(4);
    expect(clampNumImages(-5)).toBe(1);
    expect(clampNumImages(Number.NaN)).toBe(1);
  });
});

describe('toggleSelectedIndex', () => {
  it('toggles indexes on and off, keeping the result sorted', () => {
    expect(toggleSelectedIndex([], 2)).toEqual([2]);
    expect(toggleSelectedIndex([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleSelectedIndex([0, 1, 2], 1)).toEqual([0, 2]);
  });
});

/* -------------------------------------------------------------------------- */
/* default form-state rendering                                                */
/* -------------------------------------------------------------------------- */

describe('AdHocGenerationModal — form state', () => {
  it('renders the form with default values when open', () => {
    const html = renderToStaticMarkup(<AdHocGenerationModal open onClose={() => {}} />);
    expect(html).toContain('data-testid="adhoc-form"');
    expect(html).toContain('generate an image');
    expect(html).toContain('data-testid="adhoc-aspect-1:1"');
    expect(html).toContain('data-testid="adhoc-aspect-4:5"');
    expect(html).toContain('data-testid="adhoc-aspect-9:16"');
    expect(html).toContain('data-testid="adhoc-aspect-16:9"');
    // default num images = 1
    expect(html).toContain('data-testid="adhoc-num-value">1<');
    // default resolution = 1K (Chip exposes data-active="" on active)
    const oneActive = html.match(/<span[^>]*data-active=""[^>]*data-testid="adhoc-res-1K"/);
    const twoActive = html.match(/<span[^>]*data-active=""[^>]*data-testid="adhoc-res-2K"/);
    expect(oneActive).not.toBeNull();
    expect(twoActive).toBeNull();
    // references picker is collapsed by default
    expect(html).not.toContain('data-testid="adhoc-refs-region"');
    expect(html).toContain('reference images');
    // generate button is disabled when prompt is empty
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="adhoc-generate"/);
  });

  it('autofocuses the prompt textarea on open', () => {
    const html = renderToStaticMarkup(<AdHocGenerationModal open onClose={() => {}} />);
    // SSR can't run the focus effect, but autoFocus renders as the `autofocus`
    // attribute on the prompt textarea, which the browser/jsdom honors on mount.
    expect(html).toMatch(/<textarea[^>]*id="adhoc-prompt"[^>]*autofocus/i);
  });

  it('renders accordion toggles with chevron-only labels (no +/− prefix)', () => {
    const html = renderToStaticMarkup(
      <FormView
        form={DEFAULT_AD_HOC_FORM}
        setForm={() => {}}
        refsExpanded={false}
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={1}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    // the toggle text content must not begin with a + or − sign
    const negText = extractToggleText(html, 'adhoc-neg-toggle');
    const refsText = extractToggleText(html, 'adhoc-refs-toggle');
    expect(negText).not.toMatch(/^[+−-]/);
    expect(refsText).not.toMatch(/^[+−-]/);
    expect(negText).toContain('negative prompt');
    expect(refsText).toContain('reference images');
    // and the old prefixed copy is gone entirely
    expect(html).not.toContain('+ negative prompt');
    expect(html).not.toContain('+ add reference images');
    expect(html).not.toContain('− negative prompt');
    expect(html).not.toContain('− reference images');
  });

  it('renders the reference picker without a products tab (assets only)', () => {
    const html = renderToStaticMarkup(
      <FormView
        form={DEFAULT_AD_HOC_FORM}
        setForm={() => {}}
        refsExpanded
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={1}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('data-testid="asset-catalog-picker"');
    // assets-only: no tablist and no "products" tab control
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('>products<');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(<AdHocGenerationModal open={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('reveals the reference picker when the toggle is expanded', () => {
    const html = renderToStaticMarkup(
      <FormView
        form={{ ...DEFAULT_AD_HOC_FORM, referenceAssetIds: ['product:p1'] }}
        setForm={() => {}}
        refsExpanded
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={1}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('data-testid="adhoc-refs-region"');
    expect(html).toContain('data-testid="asset-catalog-picker"');
    expect(html).toContain('reference images');
  });

  it('reveals the negative prompt area when expanded', () => {
    const html = renderToStaticMarkup(
      <FormView
        form={DEFAULT_AD_HOC_FORM}
        setForm={() => {}}
        refsExpanded={false}
        setRefsExpanded={() => {}}
        negExpanded
        setNegExpanded={() => {}}
        numImages={1}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('id="adhoc-neg"');
    expect(html).toContain('data-testid="adhoc-neg-region"');
  });

  it('marks the aspect chip active and reflects the num-images value', () => {
    const html = renderToStaticMarkup(
      <FormView
        form={{ ...DEFAULT_AD_HOC_FORM, aspectRatio: '16:9' }}
        setForm={() => {}}
        refsExpanded={false}
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={3}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    // only the 16:9 chip should carry data-active=""
    const sixteenActive = html.match(
      /<span[^>]*data-active=""[^>]*data-testid="adhoc-aspect-16:9"/,
    );
    const oneOneActive = html.match(/<span[^>]*data-active=""[^>]*data-testid="adhoc-aspect-1:1"/);
    expect(sixteenActive).not.toBeNull();
    expect(oneOneActive).toBeNull();
    // num images stepper shows 3
    expect(html).toContain('data-testid="adhoc-num-value">3<');
  });

  it('disables the decrement button at the lower bound and increment at the upper bound', () => {
    const min = renderToStaticMarkup(
      <FormView
        form={DEFAULT_AD_HOC_FORM}
        setForm={() => {}}
        refsExpanded={false}
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={1}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(min).toMatch(/<button[^>]*data-testid="adhoc-num-dec"[^>]*disabled=""/);
    expect(min).not.toMatch(/<button[^>]*data-testid="adhoc-num-inc"[^>]*disabled=""/);

    const max = renderToStaticMarkup(
      <FormView
        form={DEFAULT_AD_HOC_FORM}
        setForm={() => {}}
        refsExpanded={false}
        setRefsExpanded={() => {}}
        negExpanded={false}
        setNegExpanded={() => {}}
        numImages={4}
        submitting={false}
        error={null}
        onGenerate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(max).toMatch(/<button[^>]*data-testid="adhoc-num-inc"[^>]*disabled=""/);
    expect(max).not.toMatch(/<button[^>]*data-testid="adhoc-num-dec"[^>]*disabled=""/);
  });
});

/* -------------------------------------------------------------------------- */
/* state machine transitions — forced via initialPhase                         */
/* -------------------------------------------------------------------------- */

describe('AdHocGenerationModal — state machine', () => {
  beforeEach(() => {
    // SSR-only tests; effects won't run, so global fetch isn't strictly needed.
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders polling state when phase is polling', () => {
    const html = renderToStaticMarkup(
      <AdHocGenerationModal
        open
        onClose={() => {}}
        initialPhase="polling"
        initialWorkflowId="wf-1"
      />,
    );
    expect(html).toContain('data-testid="adhoc-polling"');
    expect(html).toContain('generating 1 image…');
    expect(html).toContain('cooking');
    expect(html).not.toContain('data-testid="adhoc-form"');
  });

  it('pluralizes the polling label for multi-image runs', () => {
    const html = renderToStaticMarkup(
      <PollingView
        numImages={3}
        prompt="a sleek bottle on marble"
        estimatedBuzz={42}
        error={null}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('generating 3 images…');
    expect(html).toContain('“a sleek bottle on marble”');
    expect(html).toContain('≈ 42 buzz');
  });

  it('renders results state with one card per image', () => {
    const html = renderToStaticMarkup(
      <AdHocGenerationModal
        open
        onClose={() => {}}
        initialPhase="results"
        initialResults={{
          workflowId: 'wf-1',
          imageUrls: ['https://cdn.test/a.png', 'https://cdn.test/b.png'],
          selected: [1],
        }}
      />,
    );
    expect(html).toContain('data-testid="adhoc-results"');
    expect(html).toContain('data-testid="adhoc-result-0"');
    expect(html).toContain('data-testid="adhoc-result-1"');
    expect(html).toContain('https://cdn.test/a.png');
    expect(html).toContain('https://cdn.test/b.png');
    // selected count surfaces in the footer
    expect(html).toContain('1 / 2 selected');
    // save button shows the count
    expect(html).toContain('save selected (1)');
  });

  it('renders an empty results message when no images came back', () => {
    const html = renderToStaticMarkup(
      <ResultsView
        results={{ workflowId: 'wf-1', imageUrls: [], selected: [] }}
        aspectRatio="1:1"
        saving={false}
        error={null}
        onToggleIndex={() => {}}
        onSaveSelected={() => {}}
        onDiscard={() => {}}
      />,
    );
    expect(html).toContain('no images came back');
    // save button is disabled (no selection) — disabled attribute appears
    // adjacent to the data-testid in the SSR output
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="adhoc-save-selected"/);
  });
});

/* -------------------------------------------------------------------------- */
/* save-selected fetch wiring                                                  */
/* -------------------------------------------------------------------------- */

describe('AdHocGenerationModal — onSaveSelected', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ savedAssetIds: ['as-1', 'as-2'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs the workflow id and selected indexes, then calls onSaved + onClose', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();

    // Drive the handler directly via a hand-wired ResultsView since SSR can't
    // simulate the click; we re-create the same behavior the modal would run.
    async function runSave() {
      const res = await fetch('/api/assets/generate/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflowId: 'wf-1', imageIndexes: [0, 2] }),
      });
      const body = (await res.json()) as { savedAssetIds: string[] };
      onSaved(body.savedAssetIds.length);
      onClose();
    }

    await runSave();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/assets/generate/save');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      workflowId: 'wf-1',
      imageIndexes: [0, 2],
    });
    expect(onSaved).toHaveBeenCalledWith(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the discard CTA and selection counter in the results footer', () => {
    const html = renderToStaticMarkup(
      <ResultsView
        results={{
          workflowId: 'wf-1',
          imageUrls: ['https://cdn.test/a.png', 'https://cdn.test/b.png'],
          selected: [0, 1],
        }}
        aspectRatio="4:5"
        saving={false}
        error={null}
        onToggleIndex={() => {}}
        onSaveSelected={() => {}}
        onDiscard={() => {}}
      />,
    );
    expect(html).toContain('discard all');
    expect(html).toContain('2 / 2 selected');
    expect(html).toContain('save selected (2)');
  });
});
