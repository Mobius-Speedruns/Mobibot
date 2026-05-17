import { BotCommand } from 'src/types/app';
import { SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';

export class AllTimeCommand extends Command {
  canHandle(message: string): boolean {
    return [
      BotCommand.COMMANDS,
      BotCommand.COMMANDSALT,
      BotCommand.HELP,
    ].includes(this.getCommand(message) as BotCommand);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handle(channel: string): Promise<SendMessage | null> {
    return {
      channel,
      message:
        'Documentation is available at https://github.com/Mobius-Speedruns/Mobibot/wiki',
    };
  }
}
