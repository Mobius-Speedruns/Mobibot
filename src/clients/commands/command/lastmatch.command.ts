import { BotCommand } from 'src/types/app';
import { ChatTags, SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class LastMatchCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.LASTMATCH;
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.lastmatch(mcName);
    return {
      channel,
      message: response,
    };
  }
}
