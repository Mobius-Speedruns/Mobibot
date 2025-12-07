import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { CommandError } from '../command.error';

export class LeaveCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === 'leave';
  }

  async handle(
    channel: string,
    _message: string,
    tags: ChatTags,
  ): Promise<SendMessage | null> {
    const channelName = tags.username;
    if (!channelName) return null;

    if (channelName.toLowerCase() === process.env.HQ_TWITCH?.toLowerCase()) {
      throw new CommandError(`⚠️ Cannot leave from HQ channelName.`);
    }

    try {
      const existingChannel = await this.db.getChannel(channelName);
      if (!existingChannel) return null;
      if (existingChannel?.subscribed)
        await this.twitch.unsubscribe(channelName);
    } catch {
      throw new CommandError(
        `⚠️ Could not leave ${channelName} due to an error. Please contact mobiusspeedruns.`,
      );
    }

    try {
      // 2. If successful, try removing from DB
      const removed = await this.db.removeChannel(channelName);

      if (removed) {
        return {
          channel,
          message: `❌ Mobibot left ${channelName}`,
        };
      } else {
        // TODO: rollback? re-subscribe? at least log
        this.logger.warn(
          `Unsubscribed from Twitch but channelName ${channelName} not found in DB.`,
        );
        return null;
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to unsubscribe ${channelName}: ${err.message}`,
        );
      } else {
        this.logger.error(
          `Failed to unsubscribe ${channelName}: ${String(err)}`,
        );
      }
      throw new CommandError(
        `⚠️ Could not leave ${channelName} due to an error.`,
      );
    }
  }
}
