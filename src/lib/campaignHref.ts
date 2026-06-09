/**
 * Builds the deep-link URL for the campaign wizard with pre-staged
 * references. Encoding contract: comma-join the `asset:<id>` / `product:<id>`
 * tokens, then a single `encodeURIComponent` over the whole string. Must
 * match the decoder in `app/(app)/campaigns/new/page.tsx`.
 *
 * Accepts either:
 * - a plain `string[]` of asset IDs (legacy convenience for asset-only refs)
 * - a `CampaignRef[]` with explicit `{ kind, id }` for mixed asset/product refs
 */
export type CampaignRef = { kind: 'asset' | 'product'; id: string };

export function buildCampaignNewHref(
  refs: string[] | CampaignRef[],
): string {
  const tokens = refs.map((ref) =>
    typeof ref === 'string' ? `asset:${ref}` : `${ref.kind}:${ref.id}`,
  );
  return `/campaigns/new?refs=${encodeURIComponent(tokens.join(','))}`;
}

/**
 * Builds the deep-link URL for the photoshoot wizard with a pre-staged subject.
 * Encoding contract: single `encodeURIComponent` over the `${kind}:${id}` token.
 * Must match the decoder in `app/(app)/photoshoot/new/page.tsx`.
 */
export function buildPhotoshootNewHref(ref: CampaignRef): string {
  return `/photoshoot/new?subject=${encodeURIComponent(`${ref.kind}:${ref.id}`)}`;
}
