import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage, TwitchColor } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class RecordCommand extends Command {
  canHandle(message: string): boolean {
    return [BotCommand.RECORD, BotCommand.VS].includes(
      this.getCommand(message) as BotCommand,
    );
  }

  async getOpp(args: string[]): Promise<string | null> {
    if (args.length >= 1) {
      const opp = await this.mobibotClient.getRealNickname(args[0]);
      if (!opp) {
        return '';
      }
    }
    return null;
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
    const oppName = await this.getOpp(args);

    if (!mcName) return PLAYER_NOT_FOUND(channel);
    if (oppName === '') return PLAYER_NOT_FOUND(channel);
    if (oppName === null)
      return {
        channel,
        message: `⚠️ Please provide at least two Minecraft Usernames for the record command.`,
      };

    const response = await this.mobibotClient.record(mcName, oppName, season);
    return {
      channel,
      message: response,
    };
  }
}
