// Load environment variables
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

import { config } from './config';
import { AppClient } from './clients/app.client';
import { MobibotClient } from './clients/mobibot.client';
import { PacemanClient } from './clients/paceman.api';
import { PostgresClient } from './clients/postgres.client';
import { RankedClient } from './clients/ranked.api';
import { TwitchAuthClient } from './clients/twitch/twitch.auth';
import { TwitchHelixApi } from './clients/twitch/twitch.helix';
import { TwitchWebsocket } from './clients/twitch/twitch.websocket';
import { pinoLogger } from './logger/logger.client';

const isDocker =
  fs.existsSync('/.dockerenv') || process.env.DOCKER_ENV === 'true';
const logFile = isDocker
  ? path.join('/app/logs', 'bot.log')
  : path.join(__dirname, '../bot.log');

const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function logToFile(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  pinoLogger.info(msg);
}

async function main() {
  logToFile('Starting Mobibot...');

  const twitch_auth = new TwitchAuthClient();
  const websocket = new TwitchWebsocket();
  const paceman = new PacemanClient('https://paceman.gg/stats/api');
  const ranked = new RankedClient('https://api.mcsrranked.com');
  const twitch = new TwitchHelixApi(twitch_auth);
  const db = new PostgresClient(config.db.connectionString);
  const mobibot = new MobibotClient(paceman, ranked, db);
  const app = new AppClient(mobibot, twitch, websocket, db);

  await websocket.start();
  await app.start();
}

main().catch((err) => {
  logToFile(
    `Mobibot crashed: ${err instanceof Error ? err.stack : String(err)}`,
  );
  process.exit(1);
});
