import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class WastedCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.SESSION;
  }

  getHoursArg(args: string[]): number | null {
    // Attempt to search for hours:x
    for (const arg of args) {
      if (arg.toLowerCase().startsWith('hours:')) {
        return this.parseIntArg(arg.split(':')[1]);
      }
    }
    // Fallback to first argument
    return this.parseIntArg(args[0]);
  }

  getHoursBetweenArg(args: string[]): number | null {
    // Attempt to search for hoursBetween:x
    for (const arg of args) {
      if (arg.toLowerCase().startsWith('hoursbetween:')) {
        return this.parseIntArg(arg.split(':')[1]);
      }
    }
    // Fallback to second argument
    return this.parseIntArg(args[1]);
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage> {
    const args = this.getArgs(message);
    const hours = this.parseIntArg(args[0]) || undefined;
    const hoursBetween = this.parseIntArg(args[1]) || undefined;

    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.wastedTime(
      mcName,
      hours,
      hoursBetween,
    );
    return { channel, message: response };
  }
}
