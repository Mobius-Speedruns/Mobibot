// src/bot/TwitchBotClient.ts
import fs from 'fs';
import path from 'path';
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

const CHANNELS_FILE = path.resolve(__dirname, '../data/channels.json');
const LINKS_FILE = path.resolve(__dirname, '../data/links.json');

interface Links {
  [twitchName: string]: string; // twitchName -> minecraftName
}

export class AppClient {
  private client: TwitchClient;
  private mobibotClient: MobibotClient;
  private channels: string[] = [];
  private links: Links = {};
  private logger: PinoLogger;

  constructor(
    mobibotClient: MobibotClient,
    client: TwitchClient,
    logger: PinoLogger,
  ) {
    this.mobibotClient = mobibotClient;
    this.client = client;
    this.logger = logger.child({ Service: Service.APP });

    // TODO: remove this temporary shizz and use a DB
    this.channels = fs.existsSync(CHANNELS_FILE)
      ? JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'))
      : [];
    this.links = fs.existsSync(LINKS_FILE)
      ? JSON.parse(fs.readFileSync(LINKS_FILE, 'utf-8'))
      : {};
  }

  private saveChannels() {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(this.channels, null, 2));
  }

  private saveLinks() {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(this.links, null, 2));
  }

  public async start() {
    // Add HQ channel if not already in channels
    if (!this.channels.includes(HQ_CHANNEL)) {
      this.channels.push(HQ_CHANNEL);
      this.links[HQ_CHANNEL] = 'Inverted_Mobius';
    }

    await this.client.connect();

    // Subscribe to each channel
    for (const channel of this.channels) {
      try {
        await this.client.subscribe(channel);
        this.logger.debug(`Subscribed to EventSub for channel: ${channel}`);
      } catch (err) {
        this.logger.error(`Failed to subscribe to channel ${channel}`);
        this.logger.error(err);
      }
    }

    this.client.onChatMessage((channel, tags, message) => {
      this.handleMessage(channel, tags, message);
    });

    this.logger.debug(`Bot connected to channels: ${this.channels.join(', ')}`);
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

    if (!this.channels.includes(chanName)) {
      this.channels.push(chanName);
      this.saveChannels();

      this.links[chanName] = mcName;
      this.saveLinks();

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
  }

  private async unsubscribe(requester: string, channel: string) {
    const chanName = requester.toLowerCase();

    if (chanName === HQ_CHANNEL) {
      this.client.send(channel, `⚠️ Cannot unsubscribe from HQ channel.`);
      return;
    }

    if (this.channels.includes(chanName)) {
      this.channels = this.channels.filter((c) => c !== chanName);
      this.saveChannels();

      if (this.links[chanName]) {
        delete this.links[chanName];
        this.saveLinks();
      }

      await this.client.unsubscribe(chanName);
      this.client.send(channel, `❌ Bot unsubscribed from ${chanName}.`);
    } else {
      this.client.send(channel, `⚠️ Channel is not subscribed.`);
    }
  }

  private async link(requester: string, channel: string, message: string) {
    const chanName = requester.toLowerCase();
    const mcName = message.split(' ')[1];
    if (!mcName) {
      this.client.send(channel, `⚠️ Please provide your Minecraft Username.`);
      return;
    }

    if (!this.channels.includes(chanName)) {
      this.client.send(channel, `⚠️ Not subscribed. Use !subscribe first.`);
      return;
    }

    this.links[chanName] = mcName;
    this.saveLinks();
    this.client.send(
      channel,
      `✅ Linked Minecraft Username ${mcName} for ${chanName}`,
    );
  }

  private async unlink(requester: string, channel: string) {
    const chanName = requester.toLowerCase();
    if (!this.channels.includes(chanName)) {
      this.client.send(channel, `⚠️ Not subscribed. Use !subscribe first.`);
      return;
    }

    if (!this.links[chanName]) {
      this.client.send(channel, `⚠️ No linked Minecraft Username to unlink.`);
      return;
    }

    delete this.links[chanName];
    this.saveLinks();
    this.client.send(channel, `❌ Unlinked Minecraft Username for ${chanName}`);
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

    // Subscription / link commands
    // if (lower.startsWith('!subscribe'))
    //   return this.subscribe(username, channel, message);
    // if (lower.startsWith('!unsubscribe'))
    //   return this.unsubscribe(username, channel);
    // if (lower.startsWith('!link')) return this.link(username, channel, message);
    // if (lower.startsWith('!unlink')) return this.unlink(username, channel);

    // Don't process if it is not a valid mobibot command.
    const parts = message.slice(1).trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (!Object.values(BotCommand).includes(cmd as BotCommand)) return;

    let mcName: string | undefined;
    if (isPlus) {
      mcName = args[0];
      // TODO: possibly should remove this and default to the streamer.
      if (!mcName) {
        this.client.send(
          channel,
          `⚠️ You must specify a Minecraft Username after +${cmd}`,
        );
        return;
      }
      // Remove name from args
      args.shift();
    } else if (isBang) {
      const chanName = channel.replace('#', '');
      mcName = this.links[chanName];
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
