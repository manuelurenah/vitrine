'use client';

import { useState } from 'react';
import { PRESETS } from '@/lib/presets';
import type { CampaignTile } from '@/lib/campaigns';
import type { PresetId } from '@/lib/presets';
import { CampaignCreativeRow } from './CampaignCreativeRow';
import { groupTilesByCreative } from './creativeGroups';
import { FilterPills, type FilterOption } from './FilterPills';

type Props = {
  campaignId: string;
  tiles: CampaignTile[];
};

export function CampaignCreativeGrid({ campaignId, tiles }: Props) {
  const [activeFilter, setActiveFilter] = useState('all');

  const groups = groupTilesByCreative(tiles);

  // Build filter options: 'all' first, then one per preset present in the
  // creative groups (in order of first appearance). Counts are per creative,
  // not per variant tile.
  const seenPresets: PresetId[] = [];
  for (const g of groups) {
    if (!seenPresets.includes(g.presetId)) seenPresets.push(g.presetId);
  }

  const options: FilterOption[] = [
    { key: 'all', label: 'all', count: groups.length },
    ...seenPresets.map((presetId) => ({
      key: presetId,
      label: PRESETS[presetId].label,
      count: groups.filter((g) => g.presetId === presetId).length,
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
        {groups.map((group) => {
          // Keep the row mounted even when filtered out — it polls live
          // workflows. Toggle visibility via CSS only so polling stays alive.
          const visible = activeFilter === 'all' || group.presetId === activeFilter;
          return (
            <div key={group.key} className={visible ? '' : 'hidden'}>
              <CampaignCreativeRow campaignId={campaignId} group={group} />
            </div>
          );
        })}
      </div>
    </>
  );
}
