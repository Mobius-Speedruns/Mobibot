import { BotCommand } from '../../../types/app';
import { SplitName } from '../../../types/paceman';
import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { PLAYER_NOT_FOUND } from '../util/defaults';

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

  getSplitName(message: string): SplitName {
    const map = {
      [BotCommand.LASTENTER]: SplitName.NETHER,
      [BotCommand.LASTNETHER]: SplitName.NETHER,
      [BotCommand.LASTBASTION]: SplitName.BASTION,
      [BotCommand.LASTFORT]: SplitName.FORTRESS,
      [BotCommand.LASTBLIND]: SplitName.BLIND,
      [BotCommand.LASTSTRONGHOLD]: SplitName.STRONGHOLD,
      [BotCommand.LASTEND]: SplitName.END,
      [BotCommand.LASTFINISH]: SplitName.FINISH,
      [BotCommand.LASTPACE]: SplitName.FORTRESS,
    } as Record<string, SplitName>;
    return map[this.getCommand(message)];
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
