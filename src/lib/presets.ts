import type { AspectRatio } from './promptBuilder';

export type PresetId =
  | 'ig-feed'
  | 'ig-story'
  | 'reels'
  | 'tiktok'
  | 'fb'
  | 'li'
  | 'x'
  | 'yt'
  | 'ad-footer-320x50'
  | 'ad-leaderboard-728x90'
  | 'ad-leaderboard-970x90'
  | 'ad-rectangle-300x250'
  | 'ad-billboard-970x250'
  | 'ad-skyscraper-300x600';

export type PresetPlatform = 'social' | 'civitai-ads';

export type PresetDef = {
  id: PresetId;
  label: string;
  ratio: string;
  width: number;
  height: number;
  styleNotes: string;
  platform: PresetPlatform;
  /** Explicit generation aspect ratio. When set, overrides the derived ratio. */
  aspectRatio?: AspectRatio;
  /** When true, the deliverable must be cropped to exact width×height. */
  exact?: boolean;
};

export const PRESETS: Record<PresetId, PresetDef> = {
  'ig-feed': {
    id: 'ig-feed',
    label: 'ig · feed',
    ratio: '4:5',
    width: 832,
    height: 1024,
    styleNotes: 'editorial product photography, daylight, crisp focus, instagram-feed composition',
    platform: 'social',
  },
  'ig-story': {
    id: 'ig-story',
    label: 'ig · story',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes:
      'vertical mobile-first layout, single subject, plenty of negative space for overlay text',
    platform: 'social',
  },
  reels: {
    id: 'reels',
    label: 'reels',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes: 'vertical, motion-ready hero frame, cinematic lighting',
    platform: 'social',
  },
  tiktok: {
    id: 'tiktok',
    label: 'tiktok',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes: 'vertical, punchy, vibrant colour, hook-frame for short video',
    platform: 'social',
  },
  fb: {
    id: 'fb',
    label: 'facebook',
    ratio: '1.91:1',
    width: 1216,
    height: 640,
    styleNotes: 'wide ad creative, eye-catching, strong subject-left composition',
    platform: 'social',
  },
  li: {
    id: 'li',
    label: 'linkedin',
    ratio: '1:1',
    width: 1024,
    height: 1024,
    styleNotes: 'editorial square, premium feel, soft lighting',
    platform: 'social',
  },
  x: {
    id: 'x',
    label: 'x / twitter',
    ratio: '16:9',
    width: 1024,
    height: 576,
    styleNotes: 'horizontal share-card composition, clean centred subject',
    platform: 'social',
  },
  yt: {
    id: 'yt',
    label: 'youtube',
    ratio: '16:9',
    width: 1024,
    height: 576,
    styleNotes: 'thumbnail-grade, bold subject, high contrast',
    platform: 'social',
  },
  'ad-footer-320x50': {
    id: 'ad-footer-320x50',
    label: 'footer · 320×50',
    ratio: '320:50',
    width: 320,
    height: 50,
    styleNotes:
      'ultra-wide leaderboard ad strip; keep the product/subject and any copy within a centered horizontal safe band, simple uncluttered background that stays legible when cropped to a thin horizontal strip, generous horizontal bleed',
    platform: 'civitai-ads',
    aspectRatio: '8:1',
    exact: true,
  },
  'ad-leaderboard-728x90': {
    id: 'ad-leaderboard-728x90',
    label: 'leaderboard · 728×90',
    ratio: '728:90',
    width: 728,
    height: 90,
    styleNotes:
      'ultra-wide leaderboard ad strip; keep the product/subject and any copy within a centered horizontal safe band, simple uncluttered background that stays legible when cropped to a thin horizontal strip, generous horizontal bleed',
    platform: 'civitai-ads',
    aspectRatio: '8:1',
    exact: true,
  },
  'ad-leaderboard-970x90': {
    id: 'ad-leaderboard-970x90',
    label: 'leaderboard · 970×90',
    ratio: '970:90',
    width: 970,
    height: 90,
    styleNotes:
      'ultra-wide leaderboard ad strip; keep the product/subject and any copy within a centered horizontal safe band, simple uncluttered background that stays legible when cropped to a thin horizontal strip, generous horizontal bleed',
    platform: 'civitai-ads',
    aspectRatio: '8:1',
    exact: true,
  },
  'ad-rectangle-300x250': {
    id: 'ad-rectangle-300x250',
    label: 'rectangle · 300×250',
    ratio: '300:250',
    width: 300,
    height: 250,
    styleNotes:
      'medium rectangle ad; balanced centered composition with the product as a clear hero, modest margins on all sides for cropping',
    platform: 'civitai-ads',
    aspectRatio: '5:4',
    exact: true,
  },
  'ad-billboard-970x250': {
    id: 'ad-billboard-970x250',
    label: 'billboard · 970×250',
    ratio: '970:250',
    width: 970,
    height: 250,
    styleNotes:
      'wide billboard ad; key subject centered with a strong horizontal composition, clean background, leave bleed at top and bottom for cropping',
    platform: 'civitai-ads',
    aspectRatio: '4:1',
    exact: true,
  },
  'ad-skyscraper-300x600': {
    id: 'ad-skyscraper-300x600',
    label: 'skyscraper · 300×600',
    ratio: '300:600',
    width: 300,
    height: 600,
    styleNotes:
      'tall skyscraper ad; vertical composition with the subject centered, stacked layout, leave bleed at the left and right edges for cropping',
    platform: 'civitai-ads',
    aspectRatio: '9:16',
    exact: true,
  },
};

export function isPresetId(value: string): value is PresetId {
  return value in PRESETS;
}

export function isAdPreset(id: PresetId): boolean {
  return PRESETS[id]?.platform === 'civitai-ads';
}

export const PRESET_PLATFORMS: { id: PresetPlatform; label: string }[] = [
  { id: 'social', label: 'social' },
  { id: 'civitai-ads', label: 'civitai ads' },
];

export type BriefForPresets = {
  title: string;
  description: string;
  goal: string;
  offer: string;
  prompt: string;
  audience?: string;
  aesthetics?: string;
};
