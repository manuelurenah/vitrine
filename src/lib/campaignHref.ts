/**
 * Builds the deep-link URL for the campaign wizard with pre-staged asset
 * references. Encoding contract: comma-join the `asset:<id>` tokens, then a
 * single `encodeURIComponent` over the whole string. Must match the decoder
 * in `app/(app)/campaigns/new/page.tsx`.
 */
export function buildCampaignNewHref(assetIds: string[]): string {
  const joined = assetIds.map((id) => `asset:${id}`).join(',');
  return `/campaigns/new?refs=${encodeURIComponent(joined)}`;
}
