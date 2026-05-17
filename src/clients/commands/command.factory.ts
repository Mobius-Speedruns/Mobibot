import * as fs from 'fs';
import path from 'path';
import { Logger as PinoLogger } from 'pino';
import { pathToFileURL } from 'url';
import { MobibotClient } from '../mobibot.client';
import { PostgresClient } from '../postgres.client';
import { TwitchHelixApi } from '../twitch/twitch.helix';
import { TwitchWebsocket } from '../twitch/twitch.websocket';
import { Command } from './command.base';

export class CommandFactory {
  commands: Command[] = [];

  constructor(
    private mobibotClient?: MobibotClient,
    private db?: PostgresClient,
    private twitch?: TwitchHelixApi,
    private events?: TwitchWebsocket,
    private logger?: PinoLogger,
  ) {}

  async init(): Promise<void> {
    await this.loadCommands();
  }

  private async loadCommands(): Promise<void> {
    const dir = path.join(__dirname, 'command');
    this.logger?.info(`Loading commands from: ${dir}`);

    if (!fs.existsSync(dir)) {
      this.logger?.warn(`Command directory not found: ${dir}`);
      return;
    }

    const files = fs
      .readdirSync(dir)
      .filter(
        (f) => !f.endsWith('.d.ts') && (f.endsWith('.js') || f.endsWith('.ts')),
      );

    for (const file of files) {
      try {
        const full = path.join(dir, file);
        const mod = (await import(pathToFileURL(full).href)) as Record<
          string,
          new (...args: unknown[]) => Command
        >;

        for (const key of Object.keys(mod)) {
          const Export = mod[key];
          try {
            const inst = new Export(
              this.mobibotClient,
              this.db,
              this.twitch,
              this.events,
              this.logger,
            );
            this.commands.push(inst);
          } catch (err) {
            this.logger?.warn(
              `Failed to instantiate command ${key}: ${String(err)}`,
            );
          }
        }
      } catch (err) {
        this.logger?.warn(`Failed to load file ${file}: ${String(err)}`);
      }
    }
  }

  getCommand(message: string): Command | undefined {
    const lower = message.toLowerCase().trim();
    return this.commands.find((c) => c.canHandle(lower));
  }
}
