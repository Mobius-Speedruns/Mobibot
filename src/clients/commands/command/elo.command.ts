import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage, TwitchColor } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class EloCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.ELO;
  }

  getSeasonArgs(args: string[]): number | null {
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
  ): Promise<SendMessage | null> {
    const args = this.getArgs(message);
    const season = this.getSeasonArgs(args) || undefined;
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.elo(mcName, season);
    return {
      channel,
      message: response.response,
      color: response.color as TwitchColor,
    };
  }
}
