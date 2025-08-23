// src/app.ts

// Load environment variables
import dotenv from 'dotenv';
import { PacemanClient } from './clients/paceman.api';
import { RankedClient } from './clients/ranked.api';
import { pinoLogger } from './clients/logger.client';
import { MobibotClient } from './clients/mobibot.client';
import { TwitchClient } from './clients/twitch.client';
import { AppClient } from './clients/app.client';
import { PostgresClient } from './clients/postgres.client';
import path from 'path';
import fs from 'fs';
dotenv.config();

// Create clients
const paceman = new PacemanClient('https://paceman.gg/stats/api', pinoLogger);
const ranked = new RankedClient('https://api.mcsrranked.com', pinoLogger);
const mobibot = new MobibotClient(paceman, ranked, pinoLogger);
const db = new PostgresClient(process.env.PG_CONNECTION!, pinoLogger);

// Initialize Twitch WebSocket client
const twitchClient = new TwitchClient(pinoLogger);

// Initialize your application bot
const appClient = new AppClient(mobibot, twitchClient, db, pinoLogger);

// Ensure logs also go to a file
const logFile = path.join(__dirname, '../bot.log');
function logToFile(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  pinoLogger.info(msg); // also log via pino
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

      // Exponential backoff capped at 60 seconds
      const delay = Math.min(60_000, attempt * 5000);
      logToFile(`Restarting in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Start the bot
void runWithBackoff();
