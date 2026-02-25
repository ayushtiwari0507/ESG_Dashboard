import { z } from 'zod';

export const createEnergySchema = z.object({
  siteId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  electricityKwh: z.number().min(0).default(0),
  steamMt: z.number().min(0).default(0),
  coalMt: z.number().min(0).default(0),
  dieselLitres: z.number().min(0).default(0),
  foLitres: z.number().min(0).default(0),
  lpgKg: z.number().min(0).default(0),
  pngScm: z.number().min(0).default(0),
  renewableKwh: z.number().min(0).default(0),
});

export const updateEnergySchema = createEnergySchema.partial().omit({ siteId: true, month: true, year: true });

export type CreateEnergyInput = z.infer<typeof createEnergySchema>;
export type UpdateEnergyInput = z.infer<typeof updateEnergySchema>;
