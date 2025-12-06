import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage, TwitchColor } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class LastMatchCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.ELO;
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const args = this.getArgs(message);
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.lastmatch(mcName);
    return {
      channel,
      message: response,
    };
  }
}
