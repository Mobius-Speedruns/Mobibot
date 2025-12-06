import * as fs from 'fs';
import * as path from 'path';
import { ChatTags } from '../../types/twitch';
import { Command } from './command.base';
import { MobibotClient } from '../mobibot.client';
import { PostgresClient } from '../postgres.client';

export class CommandFactory {
  commands: Command[] = [];

  constructor(
    private mobibotClient?: MobibotClient,
    private db?: PostgresClient,
  ) {
    // Attempt to auto-load all commands in the `command` folder.
    // This uses a synchronous require so it works whether running compiled JS or ts-node during development.
    try {
      this.loadCommands();
    } catch {
      // Do nothing
    }
  }

  private loadCommands() {
    const dir = path.join(__dirname, 'command');
    if (!fs.existsSync(dir)) return;

    const files = fs
      .readdirSync(dir)
      .filter(
        (f) => !f.endsWith('.d.ts') && (f.endsWith('.js') || f.endsWith('.ts')),
      );

    for (const file of files) {
      try {
        const full = path.join(dir, file);
        // Use require so this works both for ts-node (.ts) and compiled (.js)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(full);

        for (const key of Object.keys(mod)) {
          const Export = (mod as any)[key];

          try {
            // Instantiate with known constructor shape (mobibotClient, db, ...)
            // If the command has a different signature it should handle optional params.
            const inst: Command = new Export(this.mobibotClient, this.db);
            this.commands.push(inst);
          } catch (err) {
            // ignore instantiation errors for now
          }
        }
      } catch (err) {
        // ignore per-file load errors
      }
    }
  }

  getPermissions(channel: string, message: string, tags: ChatTags): boolean {
    // TODO: check permissions on the channel
    return true;
  }

  getCommand(message: string): Command | undefined {
    const lower = message.toLowerCase().trim();
    return this.commands.find((c) => c.canHandle(lower));
  }
}
