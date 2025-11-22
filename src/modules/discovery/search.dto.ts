import { z } from 'zod';

export const SearchBasicSchema = z.object({
  ageRange: z.tuple([z.number().int().min(18), z.number().int().max(100)]).optional(),
  heightRange: z.tuple([z.number().int().min(100), z.number().int().max(250)]).optional(),
  maritalStatus: z.array(z.string()).optional(),
  religion: z.string().optional(),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

export const SearchAdvancedSchema = z.object({
  education: z.array(z.string()).optional(),
  profession: z.array(z.string()).optional(),
  income: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  diet: z.array(z.string()).optional(),
  smoking: z.string().optional(),
  drinking: z.string().optional(),
});

export const SearchRequestSchema = z.object({
  basic: SearchBasicSchema.optional(),
  advanced: SearchAdvancedSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type SearchBasicDTO = z.infer<typeof SearchBasicSchema>;
export type SearchAdvancedDTO = z.infer<typeof SearchAdvancedSchema>;
export type SearchRequestDTO = z.infer<typeof SearchRequestSchema>;

export const SaveSearchSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.object({
    basic: SearchBasicSchema.optional(),
    advanced: SearchAdvancedSchema.optional(),
  }),
});

export type SaveSearchDTO = z.infer<typeof SaveSearchSchema>;
