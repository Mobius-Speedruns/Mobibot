import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { CommandError } from '../command.error';

export class UnlinkCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === 'unlink';
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const channelName = tags.username;
    if (!channelName) return null;

    const mcUsername = await this.db.getMcName(channelName);

    if (!mcUsername) {
      throw new CommandError(
        `⚠️ No linked Minecraft username to ${channelName}`,
      );
    }

    try {
      const row = await this.db.upsertChannel(channelName);

      // Alert user about joining.
      let leaveAlert: string = '';
      if (row?.subscribed)
        leaveAlert =
          '. Please use !leave if you want Mobibot to leave your chat';

      return {
        channel,
        message: `❌ Unlinked ${mcUsername} for ${channelName}${leaveAlert}`,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to unlink MC username for ${channelName}: ${err.message}`,
        );
      } else {
        this.logger.error(
          `Failed to unlink MC username for ${channelName}: ${String(err)}`,
        );
      }

      throw new CommandError(
        `⚠️ Could not unlink Minecraft username due to a database error.`,
      );
    }
  }
}
