import z, { optional } from 'zod';

import { TwitchColor } from './twitch';

export const BOUNDS = [
  400,
  500,
  600,
  700,
  800,
  900,
  1000,
  1100,
  1200,
  1300,
  1400,
  1500,
  1650,
  1800,
  2000,
  Infinity,
] as const;

export const LABELS = [
  'Coal I',
  'Coal II',
  'Coal III',
  'Iron I',
  'Iron II',
  'Iron III',
  'Gold I',
  'Gold II',
  'Gold III',
  'Emerald I',
  'Emerald II',
  'Emerald III',
  'Diamond I',
  'Diamond II',
  'Diamond III',
  'Netherite',
] as const;

export enum MatchType {
  'Casual Match' = 1,
  'Event Mode Match' = 4,
  'Private Room Match' = 3,
  'Ranked Match' = 2,
}

export enum NETHER_TYPE {
  BRIDGE = 'BRIDGE',
  HOUSING = 'HOUSING',
  STABLES = 'STABLES',
  TREASURE = 'TREASURE',
}

export enum OVERWORLD_TYPE {
  BURIED_TREASURE = 'BURIED_TREASURE',
  DESERT_TEMPLE = 'DESERT_TEMPLE',
  RUINED_PORTAL = 'RUINED_PORTAL',
  SHIPWRECK = 'SHIPWRECK',
  VILLAGE = 'VILLAGE',
}

export enum RANK_COLOR {
  Coal = TwitchColor.Chocolate,
  Diamond = TwitchColor.DodgerBlue,
  Emerald = TwitchColor.Green,
  Gold = TwitchColor.GoldenRod,
  Iron = TwitchColor.CadetBlue,
  Netherite = TwitchColor.BlueViolet,
}

export const PLAYER_NOT_FOUND_MESSAGES = [
  'User is not exists.',
  'This player is not exist.',
];

export const ErrorResponseSchema = z.object({
  data: z.string(),
  status: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const UserProfileSchema = z.object({
  country: z.string().nullable().optional(),
  eloRank: z.number().nullable().optional(),
  eloRate: z.number().nullable().optional(),
  nickname: z.string(),
  uuid: z.string(),
});
export const MatchSeedSchema = z.object({
  id: z.string().nullable(),
  nether: z.enum(NETHER_TYPE).optional().nullable(),
  overworld: z.enum(OVERWORLD_TYPE).optional().nullable(),
});
export const MatchSchema = z.object({
  changes: z.array(
    z.object({
      change: z.number().nullable().optional(),
      eloRate: z.number().nullable().optional(),
      uuid: z.string(),
    }),
  ),
  date: z.number().optional(), // in seconds
  forfeited: z.boolean().optional(),
  id: z.number(),
  players: z.array(UserProfileSchema),
  result: z.object({
    time: z.number().optional(),
    uuid: z.string().optional().nullable(),
  }),
  season: z.number(),
  seed: MatchSeedSchema.optional().nullable(),
  type: z.enum(MatchType),
});
export const SeasonResultSchema = z.object({
  highest: z.number().nullable(),
  last: z.object({
    eloRank: z.number().nullable().optional(),
    eloRate: z.number().nullable().optional(),
    phasePoint: z.number().optional(),
  }),
  lowest: z.number().nullable().optional(),
});
export const StatisticsItemSchema = z.object({
  bestTime: z.object({
    casual: z.number().nullable().optional(),
    ranked: z.number().nullable().optional(),
  }),
  completions: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  completionTime: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  currentWinStreak: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  forfeits: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  highestWinStreak: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  loses: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  playedMatches: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  playtime: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
  wins: z.object({
    casual: z.number().optional(),
    ranked: z.number().optional(),
  }),
});
export const StatisticsSchema = z.object({
  season: StatisticsItemSchema,
  total: StatisticsItemSchema,
});
export const GetUserDataResponseSchema = z.object({
  data: UserProfileSchema.extend({
    seasonResult: SeasonResultSchema,
    statistics: StatisticsSchema,
  }),
  status: z.string().optional(),
});
export const MatchesResponseSchema = z.object({
  data: z.array(MatchSchema),
  status: z.string().optional(),
});
export const VSResponseSchema = z.object({
  data: z.object({
    players: z.array(UserProfileSchema),
    results: z.object({
      ranked: z
        .object({
          total: z.number().optional(),
        })
        .and(z.record(z.string(), z.number())),
    }),
  }),
  status: z.string(),
});
export const LeaderboardResponseSchema = z.object({
  data: z.object({
    season: z.object({
      endsAt: z.number().optional(),
      number: z.number().optional(),
      startsAt: z.number().optional(),
    }),
    users: z.array(
      UserProfileSchema.extend({
        seasonResult: z.object({
          eloRank: z.number().optional(),
          eloRate: z.number().optional(),
          phasePoint: z.number().optional(),
        }),
      }),
    ),
  }),
  status: z.string().optional(),
});

export type GetUserDataResponse = z.infer<typeof GetUserDataResponseSchema>;
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type VSResponse = z.infer<typeof VSResponseSchema>;
