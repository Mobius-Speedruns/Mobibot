import pino from 'pino';
import { config } from 'src/config';

export enum LOGGER_LEVEL {
  DEBUG = 'debug',
  ERROR = 'error',
  INFO = 'info',
  SILENT = 'silent',
  TRACE = 'trace',
}

const prettyStream = pino.transport({
  options: {
    colorize: true,
    sync: true,
    translateTime: 'SYS:standard',
  },
  target: 'pino-pretty',
});

export const pinoLogger = pino(
  {
    enabled: true,
    level: config.logger.level,
    serializers: pino.stdSerializers,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    {
      level: config.logger.level,
      stream: prettyStream,
    },
  ]),
);
