export type PresetId =
  | 'ig-feed'
  | 'ig-story'
  | 'reels'
  | 'tiktok'
  | 'fb'
  | 'li'
  | 'x'
  | 'yt';

export type PresetDef = {
  id: PresetId;
  label: string;
  ratio: string;
  width: number;
  height: number;
  styleNotes: string;
};

export const PRESETS: Record<PresetId, PresetDef> = {
  'ig-feed': {
    id: 'ig-feed',
    label: 'ig · feed',
    ratio: '4:5',
    width: 832,
    height: 1024,
    styleNotes: 'editorial product photography, daylight, crisp focus, instagram-feed composition',
  },
  'ig-story': {
    id: 'ig-story',
    label: 'ig · story',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes: 'vertical mobile-first layout, single subject, plenty of negative space for overlay text',
  },
  reels: {
    id: 'reels',
    label: 'reels',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes: 'vertical, motion-ready hero frame, cinematic lighting',
  },
  tiktok: {
    id: 'tiktok',
    label: 'tiktok',
    ratio: '9:16',
    width: 576,
    height: 1024,
    styleNotes: 'vertical, punchy, vibrant colour, hook-frame for short video',
  },
  fb: {
    id: 'fb',
    label: 'facebook',
    ratio: '1.91:1',
    width: 1216,
    height: 640,
    styleNotes: 'wide ad creative, eye-catching, strong subject-left composition',
  },
  li: {
    id: 'li',
    label: 'linkedin',
    ratio: '1:1',
    width: 1024,
    height: 1024,
    styleNotes: 'editorial square, premium feel, soft lighting',
  },
  x: {
    id: 'x',
    label: 'x / twitter',
    ratio: '16:9',
    width: 1024,
    height: 576,
    styleNotes: 'horizontal share-card composition, clean centred subject',
  },
  yt: {
    id: 'yt',
    label: 'youtube',
    ratio: '16:9',
    width: 1024,
    height: 576,
    styleNotes: 'thumbnail-grade, bold subject, high contrast',
  },
};

export function isPresetId(value: string): value is PresetId {
  return value in PRESETS;
}

export type BriefForPresets = {
  title: string;
  description: string;
  goal: string;
  offer: string;
  prompt: string;
  audience?: string;
  aesthetics?: string;
};

