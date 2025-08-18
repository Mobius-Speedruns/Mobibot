export const HQ_CHANNEL = 'mobiusspeedruns';

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
}
