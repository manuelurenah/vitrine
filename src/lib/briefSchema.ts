import { z } from 'zod';
import { isPresetId, type PresetId } from './presets';

export const briefSchema = z.object({
  prompt: z.string().min(1).max(2000),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  goal: z.string().max(120).default(''),
  offer: z.string().max(120).default(''),
  presetIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPresetId) as PresetId[])
    .refine((ids) => ids.length >= 1, 'at least one preset required'),
});

export type ValidatedBrief = z.infer<typeof briefSchema>;
