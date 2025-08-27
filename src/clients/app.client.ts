// src/bot/TwitchBotClient.ts
import { MobibotClient } from './mobibot.client';
import { Logger as PinoLogger } from 'pino';
import {
  Service,
  BotCommand,
  HOURS_BETWEEN,
  HOURS,
  INTEGER_REGEX,
  NO_ARGUMENT,
} from '../types/app';
import { SplitName } from '../types/paceman';
import { TwitchClient } from './twitch.client';
import { PostgresClient } from './postgres.client';
import { ChatTags } from '../types/twitch';
import { parseError } from '../util/parseError';

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
    await this.db.createChannel(
      process.env.HQ_TWITCH!,
      process.env.HQ_MC,
      true,
    );

    await this.client.connect();

    const channels = await this.db.listSubscribedChannels();

    await this.connectToChannels(channels);

    this.client.onChatMessage((channel, tags, message) => {
      this.handleMessage(channel, tags, message).catch((err: unknown) => {
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
          `⚠️ Please provide your Minecraft Username after !join.`,
        );
        return;
      }

      // Check username
      const mcName = await this.mobibotClient.getRealNickname(userName);
      if (!mcName) {
        await this.client.send(channel, `⚠️ Player not found in paceman.`);
        return;
      }

      // Add channel
      try {
        await this.db.createChannel(chanName, mcName, true); // Create the channel
        await this.client.subscribe(chanName); // Subscribe to channel's chat
        await this.client.send(
          channel,
          `✅ Mobibot joined ${chanName} with Minecraft Username: ${mcName}`,
        );
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
        `⚠️ Already joined. Use !link to update your Minecraft Username, or !leave to remove Mobibot from your channel.`,
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
        `⚠️ Please provide your Minecraft Username after !link.`,
      );
      return;
    }

    const mcName = await this.mobibotClient.getRealNickname(userName);
    if (!mcName) {
      await this.client.send(channel, `⚠️ Player not found in paceman.`);
      return;
    }

    try {
      const row = await this.db.upsertChannel(chanName, mcName);

      // Alert user about joining.
      let joinAlert: string = '';
      if (row?.subscribed)
        joinAlert = '. Please use !join if you want Mobibot to join your chat';

      await this.client.send(
        channel,
        `✅ Linked Minecraft Username ${mcName} to ${chanName}${joinAlert}`,
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

      await this.client.send(
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
        await this.client.send(
          channel,
          `⚠️ No linked Minecraft Username to ${chanName}`,
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
        `⚠️ Could not unlink Minecraft Username due to a database error.`,
      );
    }
  }

  private async refreshLinkedChannels() {
    const linkedChannels = await this.db.getAllChannels();

    for (const channel of linkedChannels) {
      if (!channel.mc_name) continue;
      try {
        // Get the latest real nickname from your external API
        const mcName = await this.mobibotClient.getRealNickname(
          channel.mc_name,
        );

        if (!mcName) {
          this.logger.warn(
            `Could not find MC username for ${channel.name}: ${channel.mc_name}`,
          );
          continue;
        }

        // Upsert back into the database to update timestamp
        await this.db.upsertChannel(channel.name, mcName);
        this.logger.info(
          `Refreshed MC username for ${channel.name}: ${mcName}`,
        );
      } catch (err) {
        this.logger.error(
          err,
          `Failed to refresh MC username for ${channel.name}`,
        );
      }
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

    switch (cmd.toLowerCase() as BotCommand) {
      case BotCommand.COMMANDS:
      case BotCommand.DOCS:
      case BotCommand.DOCUMENTATION:
      case BotCommand.HELP:
        response =
          'Documentation is available at https://github.com/Mobius-Speedruns/Mobibot/wiki';
        break;
      case BotCommand.SESSION: {
        const hours = this.parseIntArg(args[0]) || HOURS;
        const hoursBetween = this.parseIntArg(args[1]) || HOURS_BETWEEN;
        response = await this.mobibotClient.session(
          mcName,
          hours,
          hoursBetween,
        );
        break;
      }
      case BotCommand.RESETS: {
        const resetHours = this.parseIntArg(args[0]) || HOURS;
        const resetHoursBetween = this.parseIntArg(args[1]) || HOURS_BETWEEN;
        response = await this.mobibotClient.resets(
          mcName,
          resetHours,
          resetHoursBetween,
        );
        break;
      }
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
      case BotCommand.SEEDWAVE:
        response = await this.mobibotClient.seedwave();
        break;
      case BotCommand.VS:
      case BotCommand.RECORD: {
        if (args.length >= 1) {
          response = await this.mobibotClient.record(mcName, args[0]);
        } else {
          await this.client.send(
            channel,
            `⚠️ Please provide at least two Minecraft Usernames for the record command.`,
          );
          return;
        }
        break;
      }
      case BotCommand.WINRATE:
        response = await this.mobibotClient.winrate(mcName);
        break;
      case BotCommand.AVERAGE:
        response = await this.mobibotClient.average(mcName);
        break;
      case BotCommand.LEADERBOARD:
      case BotCommand.LB:
        response = await this.mobibotClient.leaderboard();
        break;
      default:
        return;
    }

    if (response) {
      await this.client.send(channel, response);
    }
  }

  // -----------------------------
  // Message Handler
  // -----------------------------
  private async handlePlusCommand(
    channel: string,
    cmd: string,
    username: string,
    args: string[],
  ) {
    let mcName: string;
    let remainingArgs: string[];

    if (NO_ARGUMENT.includes(cmd as BotCommand)) {
      mcName = '';
      remainingArgs = [];
    } else if (args.length > 0 && !INTEGER_REGEX.test(args[0])) {
      // First arg is a username override
      mcName = args[0];
      remainingArgs = args.slice(1);
    } else {
      // Use subscribed username
      const subscribedMcName = await this.db.getMcName(username);
      if (!subscribedMcName) {
        await this.client.send(
          channel,
          `⚠️ You must use !link to link your Minecraft Username to your twitch account before using +${cmd}.`,
        );
        return;
      }
      mcName = subscribedMcName;
      remainingArgs = args;
    }

    await this.handleCommand(channel, cmd, mcName, remainingArgs);
  }

  private async handleBangCommand(
    channel: string,
    cmd: string,
    username: string,
    args: string[],
  ) {
    // For ! commands, use the channel's linked MC name
    const chanName = channel.replace('#', '');
    const channelMcName = await this.db.getMcName(chanName);
    if (!channelMcName) {
      await this.client.send(
        channel,
        `⚠️ No linked Minecraft Username for this channel. Please link one using !link.`,
      );
      return;
    }

    await this.handleCommand(channel, cmd, channelMcName, args);
  }

  private async handleMessage(
    channel: string,
    tags: ChatTags,
    message: string,
  ) {
    // Handle + and ! commands
    const isPlus = message.startsWith('+');
    const isBang = message.startsWith('!');

    // Don't process message if it is not a command.
    if (!isPlus && !isBang) return;

    const username = tags.username || '';
    const lower = message.toLowerCase().trim();

    const parts = lower.slice(1).trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Subscription / link commands
    switch (cmd) {
      case 'join':
        return this.join(username, channel, message);
      case 'leave':
        return this.leave(username, channel);
      case 'link':
        return this.link(username, channel, message);
      case 'unlink':
        return this.unlink(username, channel);
      case 'ping':
        return this.client.send(channel, 'pong!');
    }

    // Don't process if it is not a valid mobibot command.
    if (!Object.values(BotCommand).includes(cmd as BotCommand)) return;

    try {
      if (isPlus) {
        await this.handlePlusCommand(channel, cmd, username, args);
      } else {
        await this.handleBangCommand(channel, cmd, username, args);
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  private parseIntArg(arg: string): number | null {
    if (!arg || !INTEGER_REGEX.test(arg)) return null;
    return Number(arg);
  }
}
