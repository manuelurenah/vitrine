import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryImage } from './ProductDetailGallery';
import { ProductDetailGallery } from './ProductDetailGallery';

/* -------------------------------------------------------------------------- */
/* mocks                                                                       */
/* -------------------------------------------------------------------------- */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/* -------------------------------------------------------------------------- */
/* fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const image1: GalleryImage = { id: 'img-1', name: 'photo-1.jpg', publicUrl: null };
const image2: GalleryImage = { id: 'img-2', name: 'photo-2.jpg', publicUrl: null };

/* -------------------------------------------------------------------------- */
/* ProductDetailGallery — SSR                                                  */
/* -------------------------------------------------------------------------- */

describe('ProductDetailGallery — last-image delete guard', () => {
  it('disables the delete button with the last-image aria-label when only one image', () => {
    const html = renderToStaticMarkup(
      <ProductDetailGallery
        productId="prod-1"
        productName="Test Product"
        images={[image1]}
        campaigns={[]}
      />,
    );

    // The aria-label must be the last-image message
    expect(html).toContain('aria-label="a product needs at least one image"');
    // The delete button specifically must carry the disabled attribute
    const deleteButtonMatch = html.match(
      /<button[^>]*aria-label="a product needs at least one image"[^>]*>/,
    );
    expect(deleteButtonMatch).not.toBeNull();
    expect(deleteButtonMatch![0]).toContain('disabled=""');
  });

  it('enables the delete button with the normal aria-label when more than one image', () => {
    const html = renderToStaticMarkup(
      <ProductDetailGallery
        productId="prod-1"
        productName="Test Product"
        images={[image1, image2]}
        campaigns={[]}
      />,
    );

    // React renderToStaticMarkup renders disabled={true} as disabled=""
    // and omits the attribute entirely when disabled={false}.
    // The delete button must NOT carry the disabled attribute.
    const deleteButtonMatch = html.match(
      /<button[^>]*aria-label="remove this photo"[^>]*>/,
    );
    expect(deleteButtonMatch).not.toBeNull();
    // Check no disabled="" attribute (class string may still contain "disabled:" prefix)
    expect(deleteButtonMatch![0]).not.toContain('disabled=""');
  });
});
