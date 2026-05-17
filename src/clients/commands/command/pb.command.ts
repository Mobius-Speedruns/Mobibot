import { BotCommand } from 'src/types/app';
import { ChatTags, SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

export class PbCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === BotCommand.PB;
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.pb(mcName);
    return {
      channel,
      message: response,
    };
  }
}
