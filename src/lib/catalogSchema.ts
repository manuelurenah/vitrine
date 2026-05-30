import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().min(1).max(120),
  sku: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  status: z.enum(['live', 'draft', 'archived']).default('draft'),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductCreatePayload = z.infer<typeof productCreateSchema>;
export type ProductUpdatePayload = z.infer<typeof productUpdateSchema>;
