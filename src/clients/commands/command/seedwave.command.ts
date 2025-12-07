import { BotCommand } from '../../../types/app';
import { ChatTags, SendMessage, TwitchColor } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class EloCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.SEEDWAVE;
  }

  async handle(channel: string): Promise<SendMessage | null> {
    const response = await this.mobibotClient.seedwave();
    return {
      channel,
      message: response,
    };
  }
}
