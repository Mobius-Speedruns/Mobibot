import z from 'zod';

export enum Service {
  PACEMAN = '[PACEMAN]',
  MOBIBOT = '[MOBIBOT]',
  RANKED = '[RANKED]',
  TWITCH = '[TWITCH]',
  DB = '[DB]',
  APP = '[APP]',
}

// Defaults for hours and hoursBetween
export const HOURS = 100;
export const HOURS_BETWEEN = 1;

export enum BotCommand {
  SESSION = 'session',
  RESETS = 'resets',
  PB = 'pb',
  LASTPACE = 'lastpace',
  LASTNETHER = 'lastnether',
  LASTENTER = 'lastenter',
  LASTBASTION = 'lastbastion',
  LASTFORT = 'lastfort',
  LASTBLIND = 'lastblind',
  LASTSTRONGHOLD = 'laststronghold',
  LASTEND = 'lastend',
  LASTCOMPLETION = 'lastcompletion',
  LASTFINISH = 'lastfinish',
  ELO = 'elo',
  LASTMATCH = 'lastmatch',
  DOCS = 'docs',
  DOCUMENTATION = 'documentation',
  HELP = 'help',
  COMMANDS = 'commands',
  TODAY = 'today',
  RECORD = 'record',
  VS = 'vs',
  SEEDWAVE = 'seedwave',
  WINRATE = 'winrate',
  AVERAGE = 'average',
}

export const INTEGER_REGEX = /^-?\d+$/;

export const seedwaveSchema = z.object({
  seedwave: z.number(),
  isBloodseed: z.boolean(),
});

export type Seedwave = z.infer<typeof seedwaveSchema>;
