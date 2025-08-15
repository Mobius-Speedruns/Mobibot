import pino from 'pino';

export enum LOGGER_LEVEL {
  SILENT = 'silent',
  DEBUG = 'debug',
  INFO = 'info',
  ERROR = 'error',
  TRACE = 'trace',
}

export const pinoLogger = pino({
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: pino.stdSerializers,
  enabled: true,
  level: process.env.LOGGER_LEVEL || LOGGER_LEVEL.DEBUG,
  transport: {
    target: 'pino-pretty',
    options: {
      sync: true,
      colorize: true,
    },
  },
});
