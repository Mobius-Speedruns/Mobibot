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

// Start the bot
(async () => {
  try {
    await appClient.start();
    console.log('Bot is running...');
  } catch (err) {
    console.error('Failed to start bot:', err);
    process.exit(1);
  }
})();
