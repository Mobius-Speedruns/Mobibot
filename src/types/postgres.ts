import { z } from 'zod';

export const ChannelRowSchema = z.object({
  created_at: z.date(),
  id: z.number().int(),
  mc_name: z.string().nullable(),
  name: z.string(),
  subscribed: z.boolean(),
  updated_at: z.date(),
});

export const UserRowSchema = z.object({
  created_at: z.date(),
  id: z.number().int(),
  name: z.string(),
  updated_at: z.date(),
});

export const TwitchRowSchema = z.object({
  channel: z.string(),
  id: z.number().int(),
  name: z.string(),
});

export type ChannelRow = z.infer<typeof ChannelRowSchema>;
export type TwitchRow = z.infer<typeof TwitchRowSchema>;
export type UserRow = z.infer<typeof UserRowSchema>;
