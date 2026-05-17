type Config = {
  db: {
    connectionString: string;
  };
  logger: {
    level: string;
  };
  mobibot: {
    hqMC: string;
    hqTwitch: string;
  };
  twitch: {
    botId: string;
    clientId: string;
    clientSecret: string;
    eventsubWebsocketUrl: string;
    keepaliveDuration: number;
    refreshToken: string;
  };
};

const getEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

export const config: Config = {
  db: {
    connectionString: getEnv('PG_CONNECTION'),
  },
  logger: {
    level: getEnv('LOGGER_LEVEL') || 'info',
  },
  mobibot: {
    hqMC: getEnv('HQ_MC'),
    hqTwitch: getEnv('HQ_TWITCH'),
  },
  twitch: {
    botId: getEnv('BOT_ID'),
    clientId: getEnv('CLIENT_ID'),
    clientSecret: getEnv('CLIENT_SECRET'),
    eventsubWebsocketUrl: 'wss://eventsub.wss.twitch.tv/ws',
    keepaliveDuration: 150000,
    refreshToken: getEnv('REFRESH_TOKEN'),
  },
};
