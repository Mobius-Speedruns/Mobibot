import { ChatTags, SendMessage } from '../../types/twitch';
import { MobibotClient } from '../mobibot.client';
import { PostgresClient } from '../postgres.client';
import { INTEGER_REGEX } from '../../types/app';
import { CommandError } from './command.error';
import { TwitchClient } from '../twitch.client';
import { Logger as PinoLogger } from 'pino';

export abstract class Command {
  constructor(
    protected mobibotClient: MobibotClient,
    protected db: PostgresClient,
    protected twitch: TwitchClient,
    protected logger: PinoLogger,
  ) {}

  // Return true if this command can handle the raw incoming message (lowercased)
  abstract canHandle(message: string): boolean;

  // Execute the command. The command should handle sending responses itself.
  abstract handle(
    channel: string,
    message: string,
    tags?: ChatTags,
  ): Promise<SendMessage | null>;

  isBang(message: string): boolean {
    return message.startsWith('!');
  }

  isPlus(message: string): boolean {
    return message.startsWith('+');
  }

  getCommand(message: string): string {
    // Dont handle non-commands
    if (!this.isBang(message) && !this.isPlus(message)) return '';
    const lower = message.toLowerCase().trim();
    const parts = lower.slice(1).trim().split(/\s+/);

    return parts[0];
  }

  getArgs(message: string): string[] {
    let args: string[];
    const lower = message.toLowerCase().trim();
    const parts = lower.slice(1).trim().split(/\s+/);
    args = parts.slice(1);

    if (this.isPlus(message) && args.length > 0 && !INTEGER_REGEX.test(args[0]))
      args = args.slice(1);

    return args;
  }

  async getMcName(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<string> {
    let mcName: string = '';

    if (this.isBang(message)) {
      // For ! commands, use the channel's linked MC name
      const chanName = channel.replace('#', '');
      mcName = (await this.db.getMcName(chanName)) || '';
      if (!mcName) {
        throw new CommandError(
          '⚠️ No linked Minecraft username for this channel. Please link one using !link.',
        );
      }
    } else if (this.isPlus(message)) {
      const args = this.getArgs(message);
      const username = tags.username || '';

      if (args.length > 0 && !INTEGER_REGEX.test(args[0])) {
        // First arg is a username override
        mcName = (await this.mobibotClient.getRealNickname(args[0])) || '';
      } else {
        mcName = '';
        // Use subscribed username
        const subscribedMcName = await this.db.getMcName(username);

        // If no subscribed username, attempt to find twitch relation
        if (!subscribedMcName) {
          mcName =
            (await this.mobibotClient.getRealNickname(`@${username}`)) || '';
        }
        // Otherwise, use available subscribed name
        else {
          mcName = subscribedMcName;
        }

        if (!mcName) {
          const cmd = this.getCommand(message);
          throw new CommandError(
            `⚠️ You must use !link to link your Minecraft username to your twitch account before using +${cmd}.`,
          );
        }
      }
    }

    return mcName;
  }

  parseIntArg(arg: string): null | number {
    if (!arg || !INTEGER_REGEX.test(arg)) return null;
    return Number(arg);
  }
}
