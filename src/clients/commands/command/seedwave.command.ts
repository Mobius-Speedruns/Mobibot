import { BotCommand } from 'src/types/app';
import { SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';

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
