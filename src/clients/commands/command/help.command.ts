import { BotCommand } from '../../../types/app';
import { SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';

export class AllTimeCommand extends Command {
  canHandle(message: string): boolean {
    return [
      BotCommand.COMMANDS,
      BotCommand.COMMANDSALT,
      BotCommand.HELP,
    ].includes(this.getCommand(message) as BotCommand);
  }

  async handle(channel: string): Promise<SendMessage | null> {
    return {
      channel,
      message:
        'Documentation is available at https://github.com/Mobius-Speedruns/Mobibot/wiki',
    };
  }
}
