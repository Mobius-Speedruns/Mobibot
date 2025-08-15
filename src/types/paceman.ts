import { z } from "zod";

export const runSchema = z.object({
  id: z.number(),
  twitch: z.string().optional(),
  nether: z.number().optional(),
  bastion: z.number().nullable().optional(),
  fortress: z.number().nullable().optional(),
  first_portal: z.number().nullable().optional(),
  stronghold: z.number().nullable().optional(),
  end: z.number().nullable().optional(),
  finish: z.number().nullable().optional(),
});
export const nphSchema = z.object({
  rtaph: z.number(),
  rnph: z.number(),
  lnph: z.number(),
  count: z.number(),
  avg: z.number(),
  playtime: z.number(),
  walltime: z.number(),
  resets: z.number(),
  totalResets: z.number(),
  seedsPlayed: z.number(),
  rpe: z.number(),
});
export const sessionItemSchema = z.object({
  count: z.number(),
  avg: z.string(),
});
export const sessionSchema = z.object({
  nether: sessionItemSchema,
  bastion: sessionItemSchema,
  fortress: sessionItemSchema,
  first_structure: sessionItemSchema,
  second_structure: sessionItemSchema,
  first_portal: sessionItemSchema,
  stronghold: sessionItemSchema,
  end: sessionItemSchema,
  finish: sessionItemSchema,
});
export const recentRunSchema = runSchema.extend({
  lootBastion: z.number().nullable(),
  obtainObsidian: z.number().nullable(),
  obtainCryingObsidian: z.number().nullable(),
  obtainRod: z.number().nullable(),
});

export type Run = z.infer<typeof runSchema>;
export type RecentRun = z.infer<typeof recentRunSchema>;
export type NPH = z.infer<typeof nphSchema>;
export type Session = z.infer<typeof sessionSchema>;
