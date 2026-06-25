const DEFAULT_BRAND_NAME = 'my brand';

/**
 * Returns true when the persisted brand record has enough data for the
 * onboarding completion gate:
 *   - a non-default, non-empty name, AND
 *   - at least one of: a non-empty description OR at least one palette color.
 */
export function isBrandDnaSufficient(brand: {
  name?: string | null;
  description?: string | null;
  palette?: unknown;
}): boolean {
  const name = (brand.name ?? '').trim();
  const hasName = name.length > 0 && name.toLowerCase() !== DEFAULT_BRAND_NAME;
  if (!hasName) return false;
  const hasDescription = (brand.description ?? '').trim().length > 0;
  const hasColor = Array.isArray(brand.palette) && brand.palette.length > 0;
  return hasDescription || hasColor;
}

/**
 * Returns true when the input step has the minimum to proceed:
 * a brand name plus at least a description or a URL to scrape.
 */
export function canLeaveInputStep(input: {
  brandName?: string | null;
  description?: string | null;
  url?: string | null;
}): boolean {
  const name = (input.brandName ?? '').trim();
  if (name.length === 0) return false;
  const hasDescription = (input.description ?? '').trim().length > 0;
  const hasUrl = (input.url ?? '').trim().length > 0;
  return hasDescription || hasUrl;
}
