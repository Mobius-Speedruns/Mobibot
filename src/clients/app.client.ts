import { Logger as PinoLogger } from 'pino';

import {
  BotCommand,
  HOURS,
  HOURS_BETWEEN,
  INTEGER_REGEX,
  NO_ARGUMENT,
  Service,
} from '../types/app';
import { Day, SplitName } from '../types/paceman';
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

    this.commandFactory = new CommandFactory(mobibotClient, db);
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
    // TODO: Subscription / link commands
    // switch (cmd) {
    //   case 'join':
    //     return this.join(username, channel, message);
    //   case 'leave':
    //     return this.leave(username, channel);
    //   case 'link':
    //     return this.link(username, channel, message);
    //   case 'ping':
    //     return this.client.send(channel, 'pong!');
    //   case 'unlink':
    //     return this.unlink(username, channel);
    // }

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

  // -----------------------------
  // Subscriptions
  // -----------------------------
  private async join(requester: string, channel: string, message: string) {
    const chanName = requester.toLowerCase();
    const userName = message.split(' ')[1];

    // Check for existing channel
    const existingChannel = await this.db.getChannel(chanName);
    if (!existingChannel) {
      // Bail if no username provided
      if (!userName) {
        await this.client.send(
          channel,
          `⚠️ Please provide your Minecraft username after !join.`,
        );
        return;
      }

      // Check username
      const mcName = await this.mobibotClient.getRealNickname(userName);
      if (!mcName) {
        await this.client.send(channel, `⚠️ Player not found in paceman.`);
        return;
      }

      // Alert user about joining.
      let message = `✅ Mobibot joined ${chanName} with Minecraft username: ${userName}`;

      this.logger.debug(`${mcName} - ${userName}`);
      // Alert user for possible misspell.
      if (!mcName || mcName !== userName)
        message += `. Note, you may have misspelled your username, some commands are case sensitive!`;

      // Add channel
      try {
        await this.db.createChannel(chanName, userName, true); // Create the channel
        await this.client.subscribe(chanName); // Subscribe to channel's chat
        await this.client.send(channel, message);
      } catch (err: unknown) {
        if (err instanceof Error) {
          this.logger.error(`Failed to subscribe ${chanName}: ${err.message}`);
        } else {
          this.logger.error(`Failed to subscribe ${chanName}: ${String(err)}`);
        }

        await this.client.send(
          channel,
          `⚠️ Could not join to ${chanName} due to a database error.`,
        );
      }
      return;
    }

    // Channel exists, check if they are subscribed.
    const isSubscribed = existingChannel.subscribed;
    if (!isSubscribed) {
      // Join channel
      try {
        await this.db.updateSubscription(chanName, true);
        await this.client.send(channel, `✅ Mobibot joined ${chanName}`);
      } catch (err: unknown) {
        if (err instanceof Error) {
          this.logger.error(`Failed to subscribe ${chanName}: ${err.message}`);
        } else {
          this.logger.error(`Failed to subscribe ${chanName}: ${String(err)}`);
        }

        await this.client.send(
          channel,
          `⚠️ Could not join to ${chanName} due to a database error.`,
        );
      }

      return;
    } else {
      await this.client.send(
        channel,
        `⚠️ Already joined. Use !link to update your Minecraft username, or !leave to remove Mobibot from your channel.`,
      );
      return;
    }
  }

  private async leave(requester: string, channel: string) {
    const chanName = requester.toLowerCase();

    if (chanName === process.env.HQ_TWITCH) {
      await this.client.send(channel, `⚠️ Cannot leave from HQ channel.`);
      return;
    }

    try {
      const existingChannel = await this.db.getChannel(chanName);
      if (existingChannel?.subscribed) await this.client.unsubscribe(chanName);
    } catch {
      await this.client.send(
        channel,
        `⚠️ Could not leave ${chanName} due to an error. Please contact mobiusspeedruns.`,
      );
      this.logger.error(`Failed to unsubscribe ${chanName}`);
      return;
    }

    try {
      // 2. If successful, try removing from DB
      const removed = await this.db.removeChannel(chanName);

      if (removed) {
        await this.client.send(channel, `❌ Mobibot left ${chanName}`);
      } else {
        // rollback? re-subscribe? at least log
        this.logger.warn(
          `Unsubscribed from Twitch but channel ${chanName} not found in DB.`,
        );
        await this.client.send(
          channel,
          `⚠️ Channel was not found in database.`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Failed to unsubscribe ${chanName}: ${err.message}`);
      } else {
        this.logger.error(`Failed to unsubscribe ${chanName}: ${String(err)}`);
      }
      await this.client.send(
        channel,
        `⚠️ Could not leave ${chanName} due to an error.`,
      );
    }
  }

  private async link(requester: string, channel: string, message: string) {
    const chanName = requester.toLowerCase();
    const userName = message.split(' ')[1];

    if (!userName) {
      await this.client.send(
        channel,
        `⚠️ Please provide your Minecraft username after !link.`,
      );
      return;
    }

    const mcName = await this.mobibotClient.getRealNickname(userName);

    try {
      const row = await this.db.upsertChannel(chanName, userName);

      // Alert user about joining.
      let joinAlert: string = '';
      if (!row?.subscribed)
        joinAlert = '. Please use !join if you want Mobibot to join your chat';
      let message = `✅ Linked Minecraft username ${userName} to ${chanName}${joinAlert}`;

      // Alert user for possible misspell.
      this.logger.debug(`${mcName} - ${userName}`);
      if (!mcName || mcName !== userName)
        message += `. Note, you may have misspelled your username, some commands are case sensitive!`;
      await this.client.send(channel, message);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to link MC username for ${chanName}: ${err.message}`,
        );
      } else {
        this.logger.error(
          `Failed to link MC username for ${chanName}: ${String(err)}`,
        );
      }

      await this.client.send(
        channel,
        `⚠️ Could not link Minecraft username due to a database error.`,
      );
    }
  }

  private parseIntArg(arg: string): null | number {
    if (!arg || !INTEGER_REGEX.test(arg)) return null;
    return Number(arg);
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

  private async unlink(requester: string, channel: string) {
    const chanName = requester.toLowerCase();

    try {
      const mcUsername = await this.db.getMcName(chanName);

      if (!mcUsername) {
        await this.client.send(
          channel,
          `⚠️ No linked Minecraft username to ${chanName}`,
        );
        return;
      }

      const row = await this.db.upsertChannel(chanName);
      // Alert user about joining.
      let leaveAlert: string = '';
      if (row?.subscribed)
        leaveAlert =
          '. Please use !leave if you want Mobibot to leave your chat';

      await this.client.send(
        channel,
        `❌ Unlinked ${mcUsername} for ${chanName}${leaveAlert}`,
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to unlink MC username for ${chanName}: ${err.message}`,
        );
      } else {
        this.logger.error(
          `Failed to unlink MC username for ${chanName}: ${String(err)}`,
        );
      }

      await this.client.send(
        channel,
        `⚠️ Could not unlink Minecraft username due to a database error.`,
      );
    }
  }
}
