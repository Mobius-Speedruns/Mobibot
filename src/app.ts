// src/app.ts

// Load environment variables
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { AppClient } from './clients/app.client';
import { pinoLogger } from './clients/logger.client';
import { MobibotClient } from './clients/mobibot.client';
import { PacemanClient } from './clients/paceman.api';
import { PostgresClient } from './clients/postgres.client';
import { RankedClient } from './clients/ranked.api';
import { TwitchClient } from './clients/twitch.client';
dotenv.config();

// Create clients
const db = new PostgresClient(process.env.PG_CONNECTION!, pinoLogger);
const paceman = new PacemanClient('https://paceman.gg/stats/api', pinoLogger);
const ranked = new RankedClient('https://api.mcsrranked.com', pinoLogger);
const mobibot = new MobibotClient(paceman, ranked, db, pinoLogger);

// Initialize Twitch WebSocket client
const twitchClient = new TwitchClient(pinoLogger);

// Initialize your application bot
const appClient = new AppClient(mobibot, twitchClient, db, pinoLogger);

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

function logToFile(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  pinoLogger.info(msg);
}

async function runWithBackoff() {
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      logToFile(`Starting Mobibot (attempt ${attempt})...`);
      await appClient.start();
      break;
    } catch (err) {
      logToFile(
        `Mobibot crashed: ${err instanceof Error ? err.stack : String(err)}`,
      );

      // Exponential backoff for fatal errors
      const delay = Math.min(3_600_000, Math.pow(2, attempt - 1) * 10_000); // 10s, 20s, 40s, 80s, 160s... max 1 hour
      logToFile(
        `Restarting in ${delay / 1000}s (${Math.round((delay / 60_000) * 10) / 10}min)...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Start the bot
void runWithBackoff();
