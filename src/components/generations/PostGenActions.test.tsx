import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PostGenActions, mergeChild } from './PostGenActions';

/* -------------------------------------------------------------------------- */
/* mergeChild — pure helper                                                    */
/* -------------------------------------------------------------------------- */

describe('mergeChild', () => {
  it('promotes succeeded snapshot to status=done', () => {
    const next = mergeChild(
      {
        workflowId: 'wf',
        estimatedBuzz: 0,
        kind: 'upscale',
        status: 'queued',
        imageUrl: null,
        videoUrl: null,
        error: null,
      },
      { id: 'wf', status: 'succeeded' } as never,
    );
    expect(next.status).toBe('done');
  });

  it('extracts video url from blob with mimeType=video/* for animate', () => {
    const next = mergeChild(
      {
        workflowId: 'wf',
        estimatedBuzz: 0,
        kind: 'animate',
        status: 'queued',
        imageUrl: null,
        videoUrl: null,
        error: null,
      },
      {
        id: 'wf',
        status: 'succeeded',
        steps: [
          {
            output: {
              blobs: [
                { url: 'https://cdn.test/clip.mp4', mimeType: 'video/mp4' },
              ],
            },
          },
        ],
      } as never,
    );
    expect(next.videoUrl).toBe('https://cdn.test/clip.mp4');
  });

  it('detects failure status', () => {
    const next = mergeChild(
      {
        workflowId: 'wf',
        estimatedBuzz: 0,
        kind: 'upscale',
        status: 'queued',
        imageUrl: null,
        videoUrl: null,
        error: null,
      },
      { id: 'wf', status: 'failed' } as never,
    );
    expect(next.status).toBe('failed');
  });
});

/* -------------------------------------------------------------------------- */
/* SSR rendering — overlay markup                                              */
/* -------------------------------------------------------------------------- */

describe('PostGenActions SSR', () => {
  it('renders the post-gen actions root with upscale + animate chips', () => {
    const html = renderToStaticMarkup(
      <PostGenActions workflowId="wf_x" imageIndex={0} sourceUrl="https://cdn.test/x.png" />,
    );
    expect(html).toContain('data-testid="post-gen-actions"');
    expect(html).toContain('Upscale 2');
    expect(html).toContain('Animate');
  });

  it('shows a download link when sourceUrl is provided', () => {
    const html = renderToStaticMarkup(
      <PostGenActions workflowId="wf_x" imageIndex={0} sourceUrl="https://cdn.test/x.png" />,
    );
    expect(html).toContain('data-testid="post-gen-download"');
    expect(html).toContain('href="https://cdn.test/x.png"');
  });

  it('hides download link when sourceUrl is absent', () => {
    const html = renderToStaticMarkup(<PostGenActions workflowId="wf_x" imageIndex={0} />);
    expect(html).not.toContain('data-testid="post-gen-download"');
  });

  it('disables animate when isVideo is true', () => {
    const html = renderToStaticMarkup(
      <PostGenActions workflowId="wf_x" imageIndex={0} isVideo sourceUrl="https://cdn.test/x.mp4" />,
    );
    // The animate chip is rendered as a disabled <button> with the
    // "already a video" hint and a chip-level testid.
    expect(html).toContain('data-testid="post-gen-chip-animate"');
    expect(html).toMatch(/disabled=""[^>]*title="already a video"/);
  });

  it('shows "estimate…" placeholder before any fetch has been made', () => {
    const html = renderToStaticMarkup(<PostGenActions workflowId="wf_x" imageIndex={0} />);
    expect(html).toContain('estimate');
  });
});

/* -------------------------------------------------------------------------- */
/* fetch wiring sanity — exercise the POST helper indirectly                  */
/* -------------------------------------------------------------------------- */

describe('PostGenActions fetch contract', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('SSR render does not invoke fetch (effects skipped on the server)', () => {
    renderToStaticMarkup(
      <PostGenActions workflowId="wf_x" imageIndex={2} sourceUrl="https://cdn.test/x.png" />,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
