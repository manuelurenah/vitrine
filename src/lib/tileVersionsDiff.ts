import type { AdCopy } from './adCopy';

// ---------------------------------------------------------------------------
// Shared, client-safe types + pure helpers for tile version history.
//
// This module intentionally has NO server-only / db imports so it can be
// pulled into client components (e.g. VersionHistory). The db-backed helpers
// live in `tileVersions.ts`, which re-exports everything here.
// ---------------------------------------------------------------------------

export type TileVersionSnapshot = {
  version: number;
  prompt: string;
  adCopy: { headline: string; subhead: string; cta?: string } | null;
};

export type TileFieldDiff = {
  field: 'headline' | 'subhead' | 'cta' | 'prompt';
  changed: boolean;
  old: string;
  next: string;
};

export type TileVersionEntry = {
  id: string;
  version: number;
  workflowId: string;
  prompt: string;
  adCopy: AdCopy | null;
  assetId: string | null;
  changeNote: string | null;
  createdAt: number;
};

/**
 * Compares two tile version snapshots field-by-field and returns one diff
 * entry per field in the order: headline, subhead, cta, prompt.
 */
export function diffTileVersions(
  prev: TileVersionSnapshot,
  next: TileVersionSnapshot,
): TileFieldDiff[] {
  const fields = ['headline', 'subhead', 'cta', 'prompt'] as const;

  return fields.map((field) => {
    let oldVal: string;
    let nextVal: string;

    if (field === 'prompt') {
      oldVal = prev.prompt;
      nextVal = next.prompt;
    } else {
      oldVal = prev.adCopy?.[field] ?? '';
      nextVal = next.adCopy?.[field] ?? '';
    }

    return {
      field,
      changed: oldVal !== nextVal,
      old: oldVal,
      next: nextVal,
    };
  });
}
