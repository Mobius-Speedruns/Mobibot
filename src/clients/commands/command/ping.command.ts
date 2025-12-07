import { SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';

export class PingCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === 'ping';
  }

  async handle(channel: string): Promise<SendMessage | null> {
    return {
      channel,
      message: 'pong!',
    };
  }
}
