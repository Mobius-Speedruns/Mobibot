/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();

export enum LOGGER_LEVEL {
  SILENT = 'silent',
  DEBUG = 'debug',
  INFO = 'info',
  ERROR = 'error',
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
  target: 'pino-pretty',
  options: {
    sync: true,
    colorize: true,
    translateTime: 'SYS:standard',
  },
});

export const pinoLogger = pino(
  {
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: pino.stdSerializers,
    enabled: true,
    level: process.env.LOGGER_LEVEL || LOGGER_LEVEL.SILENT,
  },
  pino.multistream([
    {
      stream: prettyStream,
      level: process.env.LOGGER_LEVEL || LOGGER_LEVEL.SILENT,
    },
    {
      level: 'warn',
      stream: fs.createWriteStream(logFile, { flags: 'a' }),
    },
  ]),
);
