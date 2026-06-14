'use client';

import { useState } from 'react';
import { PRESETS } from '@/lib/presets';
import type { CampaignTile } from '@/lib/campaigns';
import type { PresetId } from '@/lib/presets';
import { FilterPills, type FilterOption } from './FilterPills';
import { CampaignCreativeRow } from './CampaignCreativeRow';

type Props = {
  campaignId: string;
  tiles: CampaignTile[];
};

export function CampaignCreativeGrid({ campaignId, tiles }: Props) {
  const [activeFilter, setActiveFilter] = useState('all');

  // Build filter options: 'all' first, then one per preset present in tiles (in order of first appearance)
  const seenPresets: PresetId[] = [];
  for (const tile of tiles) {
    if (!seenPresets.includes(tile.presetId)) {
      seenPresets.push(tile.presetId);
    }
  }

  const options: FilterOption[] = [
    { key: 'all', label: 'all', count: tiles.length },
    ...seenPresets.map((presetId) => ({
      key: presetId,
      label: PRESETS[presetId].label,
      count: tiles.filter((t) => t.presetId === presetId).length,
    })),
  ];

  return (
    <>
      {/* Only render the pill strip when there is more than one preset to filter by */}
      {seenPresets.length > 1 && (
        <FilterPills
          options={options}
          active={activeFilter}
          onChange={setActiveFilter}
          className="mb-4"
        />
      )}

      <div className="flex flex-col">
        {tiles.map((tile) => {
          // Keep the row mounted even when filtered out — it polls a live workflow.
          // Toggle visibility via CSS only so polling stays alive.
          const visible = activeFilter === 'all' || tile.presetId === activeFilter;
          return (
            <div key={tile.id} className={visible ? '' : 'hidden'}>
              <CampaignCreativeRow campaignId={campaignId} tile={tile} />
            </div>
          );
        })}
      </div>
    </>
  );
}
