import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';

export class LeaderboardRankedCommand extends Command {
  canHandle(message: string): boolean {
    return [BotCommand.LEADERBOARD, BotCommand.LB].includes(
      this.getCommand(message) as BotCommand,
    );
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

    const response = await this.mobibotClient.rankedLeaderboard(season);
    return {
      channel,
      message: response,
    };
  }
}
