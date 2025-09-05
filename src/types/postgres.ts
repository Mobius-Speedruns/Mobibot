import { z } from 'zod';

export const ChannelRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  mc_name: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  subscribed: z.boolean(),
});

export const UserRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const TwitchRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  channel: z.string(),
});

export type ChannelRow = z.infer<typeof ChannelRowSchema>;
export type UserRow = z.infer<typeof UserRowSchema>;
export type TwitchRow = z.infer<typeof TwitchRowSchema>;
