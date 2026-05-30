import { z } from 'zod';
import { isPhotoshootTemplateId, type PhotoshootTemplateId } from './photoshootTemplates';

export const photoshootBriefSchema = z.object({
  productName: z.string().min(1).max(120),
  productNotes: z.string().min(1).max(2000),
  ratio: z.enum(['1:1', '4:5', '9:16', '16:9']),
  variantsPerTemplate: z.number().int().min(1).max(4).default(1),
  templateIds: z
    .array(z.string())
    .min(1)
    .max(8)
    .transform((ids) => ids.filter(isPhotoshootTemplateId) as PhotoshootTemplateId[])
    .refine((ids) => ids.length >= 1, 'at least one template required'),
});

export type ValidatedPhotoshootBrief = z.infer<typeof photoshootBriefSchema>;
