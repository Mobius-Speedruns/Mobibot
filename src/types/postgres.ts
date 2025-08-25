import { z } from 'zod';

export const ChannelRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  mc_name: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  subscribed: z.boolean(),
});

export type ChannelRow = z.infer<typeof ChannelRowSchema>;
