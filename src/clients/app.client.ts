import { Logger } from 'pino';
import { PlayerNotFound, ClientTimeout } from 'src/common/errors';
import { pinoLogger } from 'src/logger/logger.client';
import { Service } from 'src/types/app';
import { CommandError } from './commands/command.error';
import { CommandFactory } from './commands/command.factory';
import { MobibotClient } from './mobibot.client';
import { PostgresClient } from './postgres.client';
import { TwitchHelixApi } from './twitch/twitch.helix';
import { TwitchWebsocket } from './twitch/twitch.websocket';
import { TwitchEventNames } from 'src/events/event.types';
import { ChatTags } from './twitch/twitch.types';

export class AppClient {
  private commandFactory: CommandFactory;
  private db: PostgresClient;
  private events: TwitchWebsocket;
  private logger: Logger;
  private mobibotClient: MobibotClient;
  private twitch: TwitchHelixApi;

  constructor(
    mobibotClient: MobibotClient,
    twitch: TwitchHelixApi,
    events: TwitchWebsocket,
    db: PostgresClient,
  ) {
    this.db = db;
    this.mobibotClient = mobibotClient;
    this.twitch = twitch;
    this.events = events;
    this.logger = pinoLogger.child({ Service: Service.APP });

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

    this.commandFactory = new CommandFactory(
      mobibotClient,
      db,
      twitch,
      events,
      this.logger,
    );
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
        await this.twitch.send(
          response.channel,
          response.message,
          response.color,
        );
    } catch (err: unknown) {
      if (err instanceof CommandError) {
        // Send the user-facing error message to the channel
        await this.twitch.send(channel, err.userMessage);
        return;
      }

      if (err instanceof PlayerNotFound) {
        await this.twitch.send(channel, 'Player not found.');
        return;
      }

      if (err instanceof ClientTimeout) {
        await this.twitch.send(
          channel,
          'Paceman/Ranked timed out! Please try again later.',
        );
        return;
      }

      // Log unexpected errors but do not forward them to chat
      this.logger.error(err, 'Error executing command');
    }
  }

  public async shutdown() {
    this.logger.info('Shutting down bot, unsubscribing from all channels...');

    const channels = await this.db.listSubscribedChannels();

    // unsubscribe from each channel
    for (const channel of channels) {
      try {
        await this.twitch.unsubscribe(channel);
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
    await this.commandFactory.init();
    // Add HQ channel if not already in channels
    await this.db.createChannel(
      process.env.HQ_TWITCH!,
      process.env.HQ_MC,
      true,
    );

    const channels = await this.db.listSubscribedChannels();

    await this.connectToChannels(channels);

    this.events.on(TwitchEventNames.CHAT, (message) => {
      const event = message.payload.event;

      this.logger.debug(`incoming event: ${JSON.stringify(event)}`);

      this.handleCommand(event.broadcaster_user_login, event.message.text, {
        username: event.chatter_user_login,
      }).catch((err: unknown) => {
        this.logger.error(err, 'Error handling message');
      });
    });

    this.logger.info(`Mobibot connected to channels: ${channels.join(', ')}`);
  }

  private async connectToChannels(channels: string[]): Promise<void> {
    // Subscribe to each channel
    for (const channel of channels) {
      try {
        await this.twitch.subscribe(channel, this.events.sessionId);
      } catch (err) {
        this.logger.error(`Failed to subscribe to channel ${channel}`);
        this.logger.error(err);
      }
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
