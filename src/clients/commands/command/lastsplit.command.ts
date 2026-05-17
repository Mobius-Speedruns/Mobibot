import { BotCommand } from 'src/types/app';
import { ChatTags, SendMessage } from 'src/clients/twitch/twitch.types';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';
import { SplitName } from 'src/types/paceman';

export class SessionCommand extends Command {
  canHandle(message: string): boolean {
    return [
      BotCommand.LASTENTER,
      BotCommand.LASTNETHER,
      BotCommand.LASTBASTION,
      BotCommand.LASTBLIND,
      BotCommand.LASTFORT,
      BotCommand.LASTSTRONGHOLD,
      BotCommand.LASTEND,
      BotCommand.LASTFINISH,
      BotCommand.LASTPACE,
    ].includes(this.getCommand(message) as BotCommand);
  }

  getSplitName(message: string): SplitName | null {
    const command = this.getCommand(message);
    if (!command) return null;

    const map: Record<string, SplitName> = {
      [BotCommand.LASTENTER]: SplitName.NETHER,
      [BotCommand.LASTNETHER]: SplitName.NETHER,
      [BotCommand.LASTBASTION]: SplitName.BASTION,
      [BotCommand.LASTFORT]: SplitName.FORTRESS,
      [BotCommand.LASTBLIND]: SplitName.BLIND,
      [BotCommand.LASTSTRONGHOLD]: SplitName.STRONGHOLD,
      [BotCommand.LASTEND]: SplitName.END,
      [BotCommand.LASTFINISH]: SplitName.FINISH,
      [BotCommand.LASTPACE]: SplitName.FORTRESS,
    };

    return map[command] ?? null;
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage> {
    const mcName = await this.getMcName(channel, message, tags);

    if (!mcName) return PLAYER_NOT_FOUND(channel);

    const response = await this.mobibotClient.lastsplit(
      mcName,
      this.getSplitName(message),
    );
    return { channel, message: response };
  }
}
