import z from 'zod';

export enum MatchType {
  'Casual Match',
  'Ranked Match',
  'Private Room Match',
  'Event Mode Match',
}

export const PLAYER_NOT_FOUND_MESSAGES = [
  'User is not exists.',
  'This player is not exist.',
];

export const ErrorResponseSchema = z.object({
  status: z.string(),
  data: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const UserProfileSchema = z.object({
  uuid: z.string(),
  nickname: z.string(),
  eloRate: z.number().nullable().optional(),
  eloRank: z.number().nullable().optional(),
  country: z.string().nullable().optional(),
});
export const MatchSeedSchema = z.object({
  id: z.string(),
  overworld: z.string().optional().nullable(),
  nether: z.string().optional().nullable(),
});
export const MatchSchema = z.object({
  id: z.number(),
  type: z.enum(MatchType),
  season: z.number(),
  date: z.number(), // in seconds
  players: z.array(UserProfileSchema),
  seed: MatchSeedSchema.optional(),
  forfeited: z.boolean(),
  result: z.object({
    uuid: z.string().optional().nullable(),
    time: z.number(),
  }),
  changes: z.array(
    z.object({
      uuid: z.string(),
      change: z.number(),
      eloRate: z.number(),
    }),
  ),
});
export const SeasonResultSchema = z.object({
  last: z.object({
    eloRate: z.number().nullable().optional(),
    eloRank: z.number().nullable().optional(),
    phasePoint: z.number(),
  }),
  highest: z.number().nullable(),
  lowest: z.number().nullable(),
});
export const StatisticsItemSchema = z.object({
  bestTime: z.object({
    ranked: z.number().nullable(),
    casual: z.number().nullable(),
  }),
  highestWinStreak: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  currentWinStreak: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  playedMatches: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  playtime: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  completionTime: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  forfeits: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  completions: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  wins: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
  loses: z.object({
    ranked: z.number(),
    casual: z.number(),
  }),
});
export const StatisticsSchema = z.object({
  season: StatisticsItemSchema,
  total: StatisticsItemSchema,
});
export const GetUserDataResponseSchema = z.object({
  status: z.string(),
  data: UserProfileSchema.extend({
    seasonResult: SeasonResultSchema,
    statistics: StatisticsSchema,
  }),
});
export const MatchesResponseSchema = z.object({
  status: z.string(),
  data: z.array(MatchSchema),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type GetUserDataResponse = z.infer<typeof GetUserDataResponseSchema>;
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>;
