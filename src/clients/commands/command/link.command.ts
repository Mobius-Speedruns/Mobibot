import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { CommandError } from '../command.error';

export class LinkCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === 'link';
  }

  async handle(
    channel: string,
    message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const channelName = tags.username;
    const username = message.split(' ')[1];
    // Bail if no username provided
    if (!username)
      throw new CommandError(
        '⚠️ Please provide your Minecraft username after !link',
      );
    if (!channelName) return null;

    const mcName = await this.mobibotClient.getRealNickname(username);

    try {
      const row = await this.db.upsertChannel(channelName, username);

      // Alert user about joining.
      let joinAlert: string = '';
      if (!row?.subscribed)
        joinAlert = '. Please use !join if you want Mobibot to join your chat';
      let response = `✅ Linked Minecraft username ${username} to ${channelName}${joinAlert}`;

      // Alert user for possible misspell.
      this.logger.debug(`${mcName} - ${username}`);
      if (!mcName || mcName !== username)
        response += `. Note, you may have misspelled your username, some commands are case sensitive!`;

      return {
        channel,
        message: response,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to link MC username for ${channelName}: ${err.message}`,
        );
      } else {
        this.logger.error(
          `Failed to link MC username for ${channelName}: ${String(err)}`,
        );
      }

      throw new CommandError(
        `⚠️ Could not link Minecraft username due to a database error.`,
      );
    }
  }
}
