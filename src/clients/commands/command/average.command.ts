import { ChatTags, SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';
import { BotCommand } from 'src/types/app';

export class AverageCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.AVERAGE;
  }

  getSeasonArgs(args: string[]): null | number {
    // Attempt to search for season:x
    for (const arg of args) {
      if (arg.toLowerCase().startsWith('season:')) {
        return this.parseIntArg(arg.split(':')[1]);
      }
    }
    // Fallback to first argument
    return this.parseIntArg(args[0]);
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<null | SendMessage> {
    const args = this.getArgs(message);
    const season = this.getSeasonArgs(args) || undefined;
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.average(mcName, season);
    return { channel, message: response };
  }
}
