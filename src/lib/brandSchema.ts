import { z } from 'zod';

const hex = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3,8}$/, 'must be a hex color')
  .transform((v) => (v.startsWith('#') ? v.toLowerCase() : `#${v.toLowerCase()}`));

const nullableUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const brandUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sourceUrl: nullableUrl,
  tone: z.string().trim().max(200).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  tagline: z.string().trim().max(200).nullable().optional(),
  font: z.string().trim().max(120).nullable().optional(),
  logoUrl: nullableUrl,
  palette: z.array(hex).max(12).optional(),
  values: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  aesthetic: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
