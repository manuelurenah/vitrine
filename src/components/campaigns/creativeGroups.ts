import type { CampaignTile } from '@/lib/campaigns';
import type { PresetId } from '@/lib/presets';

/** One creative = a group of sibling variant tiles sharing a variant_group_id. */
export type CreativeGroup = {
  /** variantGroupId, or the tile id for legacy NULL-group tiles. */
  key: string;
  presetId: PresetId;
  tiles: CampaignTile[];
};

/**
 * Group tiles into creatives. New cooks produce N sibling tiles sharing a
 * `variantGroupId`; legacy tiles (NULL group) become a group of one keyed by
 * their own id. Group order follows first appearance; tiles within a group are
 * ordered by `variantIndex`.
 */
export function groupTilesByCreative(tiles: CampaignTile[]): CreativeGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, CampaignTile[]>();
  for (const t of tiles) {
    const key = t.variantGroupId ?? t.id;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(t);
  }
  return order.map((key) => {
    const groupTiles = byKey
      .get(key)!
      .slice()
      .sort((a, b) => a.variantIndex - b.variantIndex);
    return { key, presetId: groupTiles[0]!.presetId, tiles: groupTiles };
  });
}

/**
 * How many image slots a single tile renders. A grouped (new) variant tile is
 * always one image. A legacy tile renders `quantity` slots, expanding if the
 * live workflow returns more images than expected.
 */
export function slotsForTile(
  tile: Pick<CampaignTile, 'variantGroupId' | 'quantity'>,
  loadedUrlCount: number,
): number {
  if (tile.variantGroupId != null) return 1;
  return Math.max(tile.quantity ?? 1, loadedUrlCount || 1);
}
