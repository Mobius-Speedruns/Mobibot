/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
dotenv.config();

export enum LOGGER_LEVEL {
  DEBUG = 'debug',
  ERROR = 'error',
  INFO = 'info',
  SILENT = 'silent',
  TRACE = 'trace',
}

const isDocker =
  fs.existsSync('/.dockerenv') || process.env.DOCKER_ENV === 'true';
const logFile = isDocker
  ? path.join('/app/logs', 'bot.log') // Docker path
  : path.join(__dirname, '../bot.log');

// Ensure the logs directory exists
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
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
    level: process.env.LOGGER_LEVEL || LOGGER_LEVEL.SILENT,
    serializers: pino.stdSerializers,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    {
      level: process.env.LOGGER_LEVEL || LOGGER_LEVEL.SILENT,
      stream: prettyStream,
    },
    {
      level: 'warn',
      stream: fs.createWriteStream(logFile, { flags: 'a' }),
    },
  ]),
);
