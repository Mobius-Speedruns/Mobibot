import z from 'zod';

export enum Service {
  APP = '[APP]',
  DB = '[DB]',
  MOBIBOT = '[MOBIBOT]',
  PACEMAN = '[PACEMAN]',
  RANKED = '[RANKED]',
  TWITCH = '[TWITCH]',
}

// Defaults for hours and hoursBetween
export const HOURS = 1000;
export const HOURS_BETWEEN = 1;

export enum BotCommand {
  ALLTIME = 'alltime',
  AVERAGE = 'average',
  COMMANDS = 'commands',
  DAILY = 'daily',
  DOCS = 'docs',
  DOCUMENTATION = 'documentation',
  ELO = 'elo',
  HELP = 'help',
  LASTBASTION = 'lastbastion',
  LASTBLIND = 'lastblind',
  LASTCOMPLETION = 'lastcompletion',
  LASTEND = 'lastend',
  LASTENTER = 'lastenter',
  LASTFINISH = 'lastfinish',
  LASTFORT = 'lastfort',
  LASTMATCH = 'lastmatch',
  LASTNETHER = 'lastnether',
  LASTPACE = 'lastpace',
  LASTSTRONGHOLD = 'laststronghold',
  LB = 'lb',
  LEADERBOARD = 'leaderboard',
  MONTHLY = 'monthly',
  PB = 'pb',
  PLAYTIME = 'playtime',
  RECORD = 'record',
  RESETS = 'resets',
  SEEDWAVE = 'seedwave',
  SESSION = 'session',
  TODAY = 'today',
  VS = 'vs',
  WASTED = 'wasted',
  WEEKLY = 'weekly',
  WINRATE = 'winrate',
}

export const NO_ARGUMENT = [
  BotCommand.DOCUMENTATION,
  BotCommand.HELP,
  BotCommand.COMMANDS,
  BotCommand.LEADERBOARD,
  BotCommand.LB,
  BotCommand.SEEDWAVE,
  BotCommand.ALLTIME,
  BotCommand.MONTHLY,
  BotCommand.WEEKLY,
  BotCommand.DAILY,
];

export const INTEGER_REGEX = /^-?\d+$/;

export const seedwaveSchema = z.object({
  isBloodseed: z.boolean(),
  seedwave: z.number(),
});

export type Seedwave = z.infer<typeof seedwaveSchema>;
