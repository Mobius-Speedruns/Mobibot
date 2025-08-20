import { z } from 'zod';

export enum Timeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}
export enum SplitName {
  NETHER = 'nether',
  BASTION = 'bastion',
  FORTRESS = 'fortress',
  BLIND = 'first_portal',
  STRONGHOLD = 'stronghold',
  END = 'end',
  FINISH = 'finish',
}

export const runSchema = z.object({
  id: z.number(),
  nether: z.number().optional(),
  bastion: z.number().nullable().optional(),
  fortress: z.number().nullable().optional(),
  first_portal: z.number().nullable().optional(),
  stronghold: z.number().nullable().optional(),
  end: z.number().nullable().optional(),
  finish: z.number().nullable().optional(),
});
export const nphSchema = z.object({
  rtanph: z.number(),
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
  first_structure: sessionItemSchema,
  second_structure: sessionItemSchema,
  first_portal: sessionItemSchema,
  stronghold: sessionItemSchema,
  end: sessionItemSchema,
  finish: sessionItemSchema,
});
export const recentRunSchema = z.array(
  runSchema.extend({
    lootBastion: z.number().nullable(),
    obtainObsidian: z.number().nullable(),
    obtainCryingObsidian: z.number().nullable(),
    obtainRod: z.number().nullable(),
    time: z.number(),
  }),
);
export const pbSchema = z.array(
  z.object({
    name: z.string(),
    finish: z.number(),
    timestamp: z.number(),
    pb: z.string(),
  }),
);
export const userSchema = z.object({
  id: z.string(),
  nick: z.string(),
});
export const worldSchema = z.object({
  data: runSchema.extend({
    nickname: z.string(),
    twitch: z.string().nullable().optional(),
  }),
  time: z.number(),
  isLive: z.boolean(),
});

export type Run = z.infer<typeof runSchema>;
export type RecentRuns = z.infer<typeof recentRunSchema>;
export type NPH = z.infer<typeof nphSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type PB = z.infer<typeof pbSchema>;
export type User = z.infer<typeof userSchema>;
export type World = z.infer<typeof worldSchema>;
