import { Logger as PinoLogger } from 'pino';

import { INTEGER_REGEX, Service } from '../types/app';
import { ChatTags } from '../types/twitch';
import { parseError } from '../util/parseError';
import { MobibotClient } from './mobibot.client';
import { PostgresClient } from './postgres.client';
import { TwitchClient } from './twitch.client';
import { CommandFactory } from './commands/command.factory';
import { CommandError } from './commands/command.error';

export class AppClient {
  private commandFactory: CommandFactory;
  private client: TwitchClient;
  private db: PostgresClient;
  private logger: PinoLogger;
  private mobibotClient: MobibotClient;

  constructor(
    mobibotClient: MobibotClient,
    client: TwitchClient,
    db: PostgresClient,
    logger: PinoLogger,
  ) {
    this.db = db;
    this.mobibotClient = mobibotClient;
    this.client = client;
    this.logger = logger.child({ Service: Service.APP });

    // Fetch users from paceman in prod.
    if (process.env.NODE_ENV === 'production') {
      // Schedule once every 24 hours
      setInterval(() => {
        this.refreshUsers().catch((err) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.logger.error({ err }, 'refreshUsers failed'),
        );
      }, 86_400_000);

      // Refresh users on startup
      this.refreshUsers().catch((err) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.logger.error({ err }, 'initial refreshUsers failed'),
      );
    } else {
      this.logger.info('Skipping user refresh job (not in production)');
    }

    this.commandFactory = new CommandFactory(mobibotClient, db, client, logger);
  }

  public async shutdown() {
    this.logger.info('Shutting down bot, unsubscribing from all channels...');

    const channels = await this.db.listSubscribedChannels();

    // unsubscribe from each channel
    for (const channel of channels) {
      try {
        await this.client.unsubscribe(channel);
        this.logger.info(`Unsubscribed from channel ${channel}`);
      } catch (err: unknown) {
        this.logger.error(err, `Failed to unsubscribe from channel ${channel}`);
      }
    }

    await this.db.close();
    this.logger.info('Database connection closed');
  }

  public async start() {
    await this.db.init();
    // Add HQ channel if not already in channels
    await this.db.createChannel(
      process.env.HQ_TWITCH!,
      process.env.HQ_MC,
      true,
    );

    await this.client.connect();

    const channels = await this.db.listSubscribedChannels();

    await this.connectToChannels(channels);

    this.client.onChatMessage((channel, tags, message) => {
      this.handleCommand(channel, message, tags).catch((err: unknown) => {
        this.logger.error(err, 'Error handling message');
      });
    });

    this.logger.info(`Mobibot connected to channels: ${channels.join(', ')}`);

    return new Promise<void>((resolve, reject) => {
      // Set up error handling to reject the promise (triggers restart)
      this.client.on('error', (error: unknown) => {
        const msg = parseError(error);
        this.logger.error(msg);
        reject(Error(msg));
      });
    });
  }

  private async connectToChannels(channels: string[]): Promise<void> {
    // Subscribe to each channel
    for (const channel of channels) {
      try {
        await this.client.subscribe(channel);
      } catch (err) {
        this.logger.error(`Failed to subscribe to channel ${channel}`);
        this.logger.error(err);
      }
    }
  }

  // -----------------------------
  // Command Routing
  // -----------------------------
  async handleCommand(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<void> {
    try {
      const command = this.commandFactory.getCommand(message);
      if (!command) return;
      const response = await command.handle(channel, message, tags);
      if (response)
        await this.client.send(
          response.channel,
          response.message,
          response.color,
        );
    } catch (err: unknown) {
      if (err instanceof CommandError) {
        // Send the user-facing error message to the channel
        await this.client.send(channel, err.userMessage);
        return;
      }

      // Log unexpected errors but do not forward them to chat
      this.logger.error(err, 'Error executing command');
    }
  }

  private async refreshUsers(): Promise<void> {
    // TODO: add a getAll for ranked - use connections to make links between user and twitch
    this.logger.info('Refreshing users from Paceman...');

    const users = await this.mobibotClient.getAllUsers();

    for (const user of users) {
      this.logger.debug(`Upserting user ${user.nick}`);
      // Upsert user
      await this.db.upsertUser(user.nick);

      // Upsert twitch handles for this user
      for (const channel of user.twitches) {
        await this.db.upsertTwitch(user.nick, channel);
      }
    }

    this.logger.info(`Refreshed ${users.length} users.`);
  }
}
