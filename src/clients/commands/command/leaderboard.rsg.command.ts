import { BotCommand } from '../../../types/app';
import { Day } from '../../../types/paceman';
import { SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';

export class AllTimeCommand extends Command {
  canHandle(message: string): boolean {
    return [
      BotCommand.ALLTIME,
      BotCommand.DAILY,
      BotCommand.WEEKLY,
      BotCommand.MONTHLY,
    ].includes(this.getCommand(message) as BotCommand);
  }

  async handle(channel: string, message: string): Promise<SendMessage | null> {
    const dateType = this.getCommand(message) as BotCommand;
    const aggregation = {
      [BotCommand.ALLTIME]: Day.ALLTIME,
      [BotCommand.DAILY]: Day.DAILY,
      [BotCommand.WEEKLY]: Day.WEEKLY,
      [BotCommand.MONTHLY]: Day.MONTHLY,
    } as Record<string, Day>;

    const response = await this.mobibotClient.rsgLeaderboard(
      aggregation[dateType],
    );
    return {
      channel,
      message: response,
    };
  }
}
