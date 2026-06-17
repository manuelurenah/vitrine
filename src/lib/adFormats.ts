import type { AspectRatio } from './promptBuilder';

export type AdDevice = 'mobile' | 'desktop' | 'any';
export type AdSizeId = string;

export type AdFormatDef = {
  name: 'Footer' | 'Banner' | 'Rectangle' | 'Skyscraper';
  sizes: Partial<Record<AdDevice, [number, number][]>>;
};

/** Verbatim from civitai-ad-campaign-support.md. */
export const AD_FORMATS: AdFormatDef[] = [
  { name: 'Footer', sizes: { mobile: [[320, 50]], desktop: [[728, 90], [970, 90]] } },
  { name: 'Banner', sizes: { mobile: [[300, 250]], desktop: [[728, 90], [970, 250]] } },
  { name: 'Rectangle', sizes: { any: [[300, 250]] } },
  { name: 'Skyscraper', sizes: { any: [[300, 600]] } },
];

const ALLOWED: { ar: AspectRatio; r: number }[] = [
  { ar: '1:1', r: 1 },
  { ar: '4:5', r: 4 / 5 },
  { ar: '9:16', r: 9 / 16 },
  { ar: '16:9', r: 16 / 9 },
];

/** Pick the allowed generation aspect ratio nearest (by |ratio diff|) to w/h. */
export function nearestAspect(w: number, h: number): AspectRatio {
  const target = w / h;
  let best = ALLOWED[0]!;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const c of ALLOWED) {
    const diff = Math.abs(target - c.r);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best.ar;
}

export type AdSizeDef = {
  id: AdSizeId;
  label: string;
  formats: string[];
  width: number;
  height: number;
  ratio: string;
  aspectRatio: AspectRatio;
  styleNotes: string;
};

const SIZE_SLUG: Record<string, string> = {
  '320x50': 'mobile-leaderboard',
  '728x90': 'leaderboard',
  '970x90': 'large-leaderboard',
  '300x250': 'medium-rectangle',
  '970x250': 'billboard',
  '300x600': 'half-page',
};

const SIZE_NAME: Record<string, string> = {
  '320x50': 'Mobile leaderboard',
  '728x90': 'Leaderboard',
  '970x90': 'Large leaderboard',
  '300x250': 'Medium rectangle',
  '970x250': 'Billboard',
  '300x600': 'Half-page',
};

function styleNotesFor(w: number, h: number): string {
  const r = w / h;
  if (r >= 4)
    return 'ultra-wide leaderboard ad strip; keep the product/subject and any copy inside a centered horizontal safe band, simple uncluttered background that stays legible when cropped to a thin horizontal strip, generous horizontal bleed';
  if (r > 1.4)
    return 'wide billboard ad; key subject centered with a strong horizontal composition, clean background, leave bleed at top and bottom for cropping';
  if (r < 0.7)
    return 'tall skyscraper ad; vertical composition with the subject centered, stacked layout, leave bleed at the left and right edges for cropping';
  return 'medium rectangle ad; balanced centered composition with the product as a clear hero, modest margins on all sides for cropping';
}

function buildSizes(): Record<AdSizeId, AdSizeDef> {
  const byDim = new Map<string, { w: number; h: number; formats: Set<string> }>();
  for (const f of AD_FORMATS) {
    for (const dims of Object.values(f.sizes)) {
      for (const [w, h] of dims ?? []) {
        const key = `${w}x${h}`;
        const entry = byDim.get(key) ?? { w, h, formats: new Set<string>() };
        entry.formats.add(f.name);
        byDim.set(key, entry);
      }
    }
  }
  const out: Record<AdSizeId, AdSizeDef> = {};
  for (const { w, h, formats } of byDim.values()) {
    const key = `${w}x${h}`;
    const id = `${SIZE_SLUG[key]}-${key}`;
    out[id] = {
      id,
      label: `${SIZE_NAME[key]} · ${w}×${h}`,
      formats: [...formats],
      width: w,
      height: h,
      ratio: `${w}:${h}`,
      aspectRatio: nearestAspect(w, h),
      styleNotes: styleNotesFor(w, h),
    };
  }
  return out;
}

export const AD_SIZES: Record<AdSizeId, AdSizeDef> = buildSizes();
export const AD_SIZE_LIST: AdSizeDef[] = Object.values(AD_SIZES);

export function isAdSizeId(v: string): v is AdSizeId {
  return v in AD_SIZES;
}

/** Default selection: one of each common shape (rectangle, leaderboard, skyscraper, billboard). */
export function recommendedAdSizeIds(): AdSizeId[] {
  return [
    'medium-rectangle-300x250',
    'leaderboard-728x90',
    'half-page-300x600',
    'billboard-970x250',
  ];
}
