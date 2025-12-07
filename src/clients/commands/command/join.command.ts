import { ChatTags, SendMessage } from '../../../types/twitch';
import { Command } from '../command.base';
import { CommandError } from '../command.error';

export class JoinCommand extends Command {
  canHandle(message: string): boolean {
    return this.getCommand(message) === 'join';
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
        '⚠️ Please provide your Minecraft username after !join.',
      );
    if (!channelName) return null;

    // Check for existing channelName
    const existingChannel = await this.db.getChannel(channelName);
    if (existingChannel) {
      throw new CommandError(
        `⚠️ ${channelName} already joined. Use !link to update your Minecraft username, or !leave to remove Mobibot from your channelName.`,
      );
    }

    // Check username
    const mcName = await this.mobibotClient.getRealNickname(username);
    if (!mcName) {
      throw new CommandError(`⚠️ Player not found in paceman.`);
    }

    // Alert user about joining.
    let response = `✅ Mobibot joined ${channelName} with Minecraft username: ${username}`;

    this.logger.debug(`${mcName} - ${username}`);
    // Alert user for possible misspell.
    if (!mcName || mcName !== username)
      response += `. Note, you may have misspelled your username, some commands are case sensitive!`;

    // Add channelName
    try {
      await this.db.createChannel(channelName, username, true); // Create the channelName
      await this.twitch.subscribe(channelName); // Subscribe to channelName's chat
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`Failed to subscribe ${channelName}: ${err.message}`);
      } else {
        this.logger.error(`Failed to subscribe ${channelName}: ${String(err)}`);
      }

      throw new CommandError(
        `⚠️ Could not join to ${channelName} due to a database error.`,
      );
    }
    return {
      channel,
      message: response,
    };
  }
}
