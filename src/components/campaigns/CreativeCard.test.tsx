import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock the SDK orchestrator module so `extractImageUrls` is deterministic and
// no orchestrator client gets constructed during static rendering.
const orchestratorMocks = vi.hoisted(() => {
  const extractImageUrls = vi.fn((snap: unknown) => {
    if (!snap) return [];
    const s = snap as { _urls?: string[] };
    return s._urls ?? [];
  });
  return { extractImageUrls };
});

vi.mock('@civitai/app-sdk/orchestrator', () => orchestratorMocks);

import { CreativeCard } from './CreativeCard';

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

/* -------------------------------------------------------------------------- */
/* single-image branch                                                         */
/* -------------------------------------------------------------------------- */

describe('CreativeCard — single image (quantity === 1)', () => {
  it('renders the existing single-tile layout (no skeleton grid) when quantity is 1', () => {
    const html = render(
      <CreativeCard workflowId="wf_1" presetId="ig-feed" quantity={1} />,
    );
    // No multi-image skeleton placeholders
    expect(html).not.toContain('data-testid="image-skeleton"');
    // Status overlay reflects initial "cooking" state via mono-cased label
    expect(html.toLowerCase()).toContain('cooking');
    // Preset badge present once
    expect(html).toContain('ig · feed');
  });

  it('omits skeletons even when quantity is unspecified (defaults to 1)', () => {
    const html = render(<CreativeCard workflowId="wf_1" presetId="ig-feed" />);
    expect(html).not.toContain('data-testid="image-skeleton"');
  });
});

/* -------------------------------------------------------------------------- */
/* multi-image branch                                                          */
/* -------------------------------------------------------------------------- */

describe('CreativeCard — multi image (quantity > 1)', () => {
  it('renders N skeleton placeholders before any image lands', () => {
    const html = render(
      <CreativeCard workflowId="wf_1" presetId="ig-feed" quantity={4} />,
    );
    const skeletonCount = html.match(/data-testid="image-skeleton"/g)?.length ?? 0;
    expect(skeletonCount).toBe(4);
    // Each slot is wrapped in a data-image-overlay div (workstream K hook)
    const overlayCount = html.match(/data-image-overlay/g)?.length ?? 0;
    expect(overlayCount).toBe(4);
  });

  it('uses a 2-column grid for quantity 2-4', () => {
    const html = render(
      <CreativeCard workflowId="wf_1" presetId="ig-feed" quantity={3} />,
    );
    expect(html).toContain('grid-cols-2');
    // 3 skeleton slots
    expect(html.match(/data-testid="image-skeleton"/g)?.length ?? 0).toBe(3);
  });

  it('switches to a horizontal scroll strip for quantity >= 5', () => {
    const html = render(
      <CreativeCard workflowId="wf_1" presetId="ig-feed" quantity={6} />,
    );
    // The strip layout uses overflow-x-auto rather than a grid
    expect(html).toContain('overflow-x-auto');
    expect(html).not.toMatch(/grid grid-cols-2/);
    expect(html.match(/data-testid="image-skeleton"/g)?.length ?? 0).toBe(6);
  });

  it('still wraps each slot in a data-image-overlay div even when empty', () => {
    const html = render(
      <CreativeCard workflowId="wf_1" presetId="ig-feed" quantity={2} />,
    );
    // Two overlay containers, regardless of whether the image has loaded yet —
    // workstream K depends on this anchor to mount its action menu.
    expect(html.match(/data-image-overlay/g)?.length ?? 0).toBe(2);
  });
});
