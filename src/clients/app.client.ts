// src/bot/TwitchBotClient.ts
import { MobibotClient } from './mobibot.client';
import { Logger as PinoLogger } from 'pino';
import {
  Service,
  BotCommand,
  HQ_CHANNEL,
  HOURS_BETWEEN,
  HOURS,
} from '../types/app';
import { SplitName } from '../types/paceman';
import { TwitchClient } from './twitch.client';
import { PostgresClient } from './postgres.client';

export class AppClient {
  private db: PostgresClient;
  private client: TwitchClient;
  private mobibotClient: MobibotClient;
  private logger: PinoLogger;

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
  }

  public async start() {
    await this.db.init();
    // Add HQ channel if not already in channels
    await this.db.upsertChannel('mobiusspeedruns', 'Inverted_Mobius');

    await this.client.connect();

    const channels = await this.db.listChannels();
    // Subscribe to each channel
    for (const channel of channels) {
      try {
        await this.client.subscribe(channel);
      } catch (err) {
        this.logger.error(`Failed to subscribe to channel ${channel}`);
        this.logger.error(err);
      }
    }

    this.client.onChatMessage((channel, tags, message) => {
      this.handleMessage(channel, tags, message);
    });

    this.logger.debug(`Bot connected to channels: ${channels.join(', ')}`);
  }

  public async shutdown() {
    this.logger.info('Shutting down bot, unsubscribing from all channels...');

    const channels = await this.db.listChannels();

    // unsubscribe from each channel
    for (const channel of channels) {
      try {
        await this.client.unsubscribe(channel);
        this.logger.info(`Unsubscribed from channel ${channel}`);
      } catch (err: unknown) {
        this.logger.error(`Failed to unsubscribe from channel ${channel}`);
      }
    }

    await this.db.close();
    this.logger.info('Database connection closed');
  }

  // -----------------------------
  // Subscriptions
  // -----------------------------
  private async subscribe(requester: string, channel: string, message: string) {
    const chanName = requester.toLowerCase();
    const mcName = message.split(' ')[1];

    if (!mcName) {
      this.client.send(channel, `⚠️ Please provide your Minecraft Username.`);
      return;
    }

    try {
      const channelRecord = await this.db.upsertChannel(chanName, mcName);

      if (!channelRecord.existed) {
        await this.client.subscribe(chanName);
        this.client.send(
          channel,
          `✅ Bot subscribed to ${chanName} with Minecraft Username: ${mcName}`,
        );
      } else {
        this.client.send(
          channel,
          `⚠️ Already subscribed. Use !link to update your Minecraft Username.`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Failed to subscribe ${chanName}: ${err.message}`);
      } else {
        this.logger.error(`Failed to subscribe ${chanName}: ${String(err)}`);
      }

      this.client.send(
        channel,
        `⚠️ Could not subscribe to ${chanName} due to a database error.`,
      );
    }
  }

  private async unsubscribe(requester: string, channel: string) {
    const chanName = requester.toLowerCase();

    if (chanName === HQ_CHANNEL) {
      this.client.send(channel, `⚠️ Cannot unsubscribe from HQ channel.`);
      return;
    }

    try {
      try {
        await this.client.unsubscribe(chanName);
      } catch {
        this.client.send(
          channel,
          `⚠️ Could not unsubscribe ${chanName} due to an error.`,
        );
        this.logger.error(`Failed to unsubscribe ${chanName}`);
        return;
      }

      // 2. If successful, try removing from DB
      const removed = await this.db.removeChannel(chanName);

      if (removed) {
        this.client.send(channel, `❌ Bot unsubscribed from ${chanName}.`);
      } else {
        // rollback? re-subscribe? at least log
        this.logger.warn(
          `Unsubscribed from Twitch but channel ${chanName} not found in DB.`,
        );
        this.client.send(channel, `⚠️ Channel was not found in database.`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Failed to unsubscribe ${chanName}: ${err.message}`);
      } else {
        this.logger.error(`Failed to unsubscribe ${chanName}: ${String(err)}`);
      }
      this.client.send(
        channel,
        `⚠️ Could not unsubscribe ${chanName} due to an error.`,
      );
    }
  }

  private async link(requester: string, channel: string, message: string) {
    const chanName = requester.toLowerCase();
    const mcName = message.split(' ')[1];

    if (!mcName) {
      this.client.send(channel, `⚠️ Please provide your Minecraft Username.`);
      return;
    }

    try {
      await this.db.upsertChannel(chanName, mcName);
      this.client.send(
        channel,
        `✅ Linked Minecraft Username ${mcName} for ${chanName}`,
      );
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

      this.client.send(
        channel,
        `⚠️ Could not link Minecraft Username due to a database error.`,
      );
    }
  }

  private async unlink(requester: string, channel: string) {
    const chanName = requester.toLowerCase();

    try {
      const mcUsername = await this.db.getMcName(chanName);

      if (!mcUsername) {
        this.client.send(
          channel,
          `⚠️ No linked Minecraft Username to ${chanName}.`,
        );
        return;
      }

      await this.db.upsertChannel(chanName);
      this.client.send(channel, `❌ Unlinked ${mcUsername} for ${chanName}`);
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

      this.client.send(
        channel,
        `⚠️ Could not unlink Minecraft Username due to a database error.`,
      );
    }
  }

  // -----------------------------
  // Command Routing
  // -----------------------------
  private async handleCommand(
    channel: string,
    cmd: string,
    mcName: string,
    args: string[],
  ): Promise<void> {
    let response: string | void;
    switch (cmd.toLowerCase()) {
      case BotCommand.COMMANDS:
      case BotCommand.DOCS:
      case BotCommand.DOCUMENTATION:
      case BotCommand.HELP:
        response =
          'Documentation is available at https://github.com/Mobius-Speedruns/Mobibot/wiki';
        break;
      case BotCommand.SESSION:
        response = await this.mobibotClient.session(
          mcName,
          Number(args[0]) || HOURS,
          Number(args[1]) || HOURS_BETWEEN,
        );
        break;
      case BotCommand.LASTENTER:
      case BotCommand.LASTNETHER:
        response = await this.mobibotClient.lastsplit(mcName, SplitName.NETHER);
        break;
      case BotCommand.LASTBASTION:
        response = await this.mobibotClient.lastsplit(
          mcName,
          SplitName.BASTION,
        );
        break;
      case BotCommand.LASTPACE:
      case BotCommand.LASTFORT:
        response = await this.mobibotClient.lastsplit(
          mcName,
          SplitName.FORTRESS,
        );
        break;
      case BotCommand.LASTBLIND:
        response = await this.mobibotClient.lastsplit(mcName, SplitName.BLIND);
        break;
      case BotCommand.LASTSTRONGHOLD:
        response = await this.mobibotClient.lastsplit(
          mcName,
          SplitName.STRONGHOLD,
        );
        break;
      case BotCommand.LASTEND:
        response = await this.mobibotClient.lastsplit(mcName, SplitName.END);
        break;
      case BotCommand.LASTFINISH:
      case BotCommand.LASTCOMPLETION:
        response = await this.mobibotClient.lastsplit(mcName, SplitName.FINISH);
        break;
      case BotCommand.RESETS:
        response = await this.mobibotClient.resets(
          mcName,
          Number(args[0]) || HOURS,
          Number(args[1]) || HOURS_BETWEEN,
        );
        break;
      case BotCommand.PB:
        response = await this.mobibotClient.pb(mcName);
        break;
      case BotCommand.ELO:
        response = await this.mobibotClient.elo(mcName);
        break;
      case BotCommand.LASTMATCH:
        response = await this.mobibotClient.lastmatch(mcName);
        break;
      case BotCommand.TODAY:
        response = await this.mobibotClient.today(mcName);
        break;
      default:
        // Do nothing on unknown commands.
        return;
    }

    if (response) this.client.send(channel, response);
  }

  // -----------------------------
  // Message Handler
  // -----------------------------
  private async handleMessage(channel: string, tags: any, message: string) {
    // Handle + and ! commands
    const isPlus = message.startsWith('+');
    const isBang = message.startsWith('!');

    // Don't process message if it is not a command.
    if (!isPlus && !isBang) return;

    const username = tags.username || '';
    const lower = message.toLowerCase();

    const parts = lower.slice(1).trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Subscription / link commands
    switch (cmd) {
      case 'subscribe':
        return this.subscribe(username, channel, message);
      case 'unsubscribe':
        return this.unsubscribe(username, channel);
      case 'link':
        return this.link(username, channel, message);
      case 'unlink':
        return this.unlink(username, channel);
    }

    // Don't process if it is not a valid mobibot command.
    if (!Object.values(BotCommand).includes(cmd as BotCommand)) return;

    let mcName: string | undefined;
    if (isPlus) {
      mcName = args[0];
      if (!mcName) {
        // Attempt to find subscription
        const subscribed_mcName = await this.db.getMcName(username);
        if (!subscribed_mcName) {
          this.client.send(
            channel,
            `⚠️ You must specify a Minecraft Username after +${cmd}`,
          );
          return;
        }
        // Safe to use subscribed_mcName
        mcName = subscribed_mcName;
      }
      // Remove name from args
      args.shift();
    } else if (isBang) {
      const chanName = channel.replace('#', '');
      mcName = await this.db.getMcName(chanName);
      if (!mcName) {
        this.client.send(
          channel,
          `⚠️ No linked Minecraft Username for this channel.`,
        );
        return;
      }
    }

    try {
      if (!mcName) {
        this.logger.warn(
          `Something went wrong while processing ${channel}.${cmd}, missing name!`,
        );
        return;
      }
      await this.handleCommand(channel, cmd, mcName, args);
      return;
    } catch (err) {
      this.logger.error(err);
      return;
    }
  }
}
