import { SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';

export class PingCommand extends Command {
  canHandle(message: string): boolean {
    return (this.getCommand(message) as string) === 'ping';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handle(channel: string): Promise<SendMessage | null> {
    return {
      channel,
      message: 'pong!',
    };
  }
}
