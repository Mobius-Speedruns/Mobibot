import { z } from 'zod';

export enum Day {
  ALLTIME = 9999,
  DAILY = 1,
  MONTHLY = 30,
  WEEKLY = 7,
}
export enum SplitName {
  BASTION = 'bastion',
  BLIND = 'first_portal',
  END = 'end',
  FINISH = 'finish',
  FORTRESS = 'fortress',
  NETHER = 'nether',
  STRONGHOLD = 'stronghold',
}

export enum Timeframe {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

export const runSchema = z.object({
  bastion: z.number().nullable().optional(),
  end: z.number().nullable().optional(),
  finish: z.number().nullable().optional(),
  first_portal: z.number().nullable().optional(),
  fortress: z.number().nullable().optional(),
  id: z.number(),
  nether: z.number().optional(),
  stronghold: z.number().nullable().optional(),
});
export const nphSchema = z.object({
  avg: z.number(),
  count: z.number(),
  lnph: z.number(),
  playtime: z.number(),
  resets: z.number(),
  rnph: z.number(),
  rpe: z.number(),
  rtanph: z.number(),
  seedsPlayed: z.number(),
  totalResets: z.number(),
  walltime: z.number(),
});
export const sessionItemSchema = z.object({
  avg: z.string(),
  count: z.number(),
});
export const sessionSchema = z.object({
  end: sessionItemSchema,
  finish: sessionItemSchema,
  first_portal: sessionItemSchema,
  first_structure: sessionItemSchema,
  nether: sessionItemSchema,
  second_structure: sessionItemSchema,
  stronghold: sessionItemSchema,
});
export const recentRunSchema = z.array(
  runSchema.extend({
    lootBastion: z.number().nullable(),
    obtainCryingObsidian: z.number().nullable(),
    obtainObsidian: z.number().nullable(),
    obtainRod: z.number().nullable(),
    realUpdated: z.number().nullable(),
    time: z.number(),
    updatedTime: z.number().nullable(),
  }),
);
export const pbSchema = z.array(
  z.object({
    finish: z.number(),
    name: z.string(),
    pb: z.string(),
    timestamp: z.number(),
  }),
);
export const userSchema = z.object({
  id: z.string(),
  nick: z.string(),
  twitches: z.array(z.string()),
});
export const worldSchema = z.object({
  data: runSchema.extend({
    nickname: z.string(),
    twitch: z.string().nullable().optional(),
  }),
  isLive: z.boolean(),
  time: z.number(),
});
export const leadboardSchema = z.object({
  avg: z.number(),
  name: z.string(),
  qty: z.number(),
  uuid: z.string(),
  value: z.number(),
});

export type Leaderboard = z.infer<typeof leadboardSchema>;
export type NPH = z.infer<typeof nphSchema>;
export type PB = z.infer<typeof pbSchema>;
export type RecentRuns = z.infer<typeof recentRunSchema>;
export type Run = z.infer<typeof runSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type User = z.infer<typeof userSchema>;
export type World = z.infer<typeof worldSchema>;
