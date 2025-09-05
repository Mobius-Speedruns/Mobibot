import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import {
  ChannelRow,
  ChannelRowSchema,
  TwitchRow,
  TwitchRowSchema,
  UserRow,
  UserRowSchema,
} from '../types/postgres';
import { parseError } from '../util/parseError';

export class PostgresClient {
  private pool: Pool;
  private logger: PinoLogger;

  constructor(connectionString: string, logger: PinoLogger) {
    this.logger = logger.child({ Service: Service.DB });
    this.pool = new Pool({
      connectionString,
    });
  }

  private async createMigrationsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  private async getMigrationStatus(filename: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM migrations WHERE filename = $1',
      [filename],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async recordMigration(filename: string) {
    await this.pool.query('INSERT INTO migrations (filename) VALUES ($1)', [
      filename,
    ]);
  }

  async init() {
    // First ensure the migrations table exists
    await this.createMigrationsTable();

    // Define migrations in order
    const migrationFiles = [
      '001_init.sql',
      '002_add_subscribed_column.sql',
      '003_create_user_cache.sql',
    ];

    for (const file of migrationFiles) {
      try {
        // Check if migration already executed
        const isExecuted = await this.getMigrationStatus(file);
        if (isExecuted) {
          this.logger.info(`Migration ${file} already executed, skipping`);
          continue;
        }

        // Execute migration
        const sql = fs.readFileSync(
          path.join(__dirname, '../../migrations', file),
          'utf8',
        );
        await this.pool.query(sql);

        // Record migration was executed
        await this.recordMigration(file);
        this.logger.info(`Migration ${file} completed successfully`);
      } catch (error: unknown) {
        this.logger.error(
          { msg: parseError(error) },
          `Migration ${file} failed:`,
        );
        throw error;
      }
    }
  }

  async upsertChannel(
    name: string,
    mcName?: string,
  ): Promise<ChannelRow | null> {
    const res = await this.pool.query<ChannelRow>(
      `
      INSERT INTO channels (name, mc_name)
      VALUES ($1, $2)
      ON CONFLICT (name)
      DO UPDATE SET 
        mc_name = EXCLUDED.mc_name,
        updated_at = NOW()
      RETURNING *`,
      [name.toLowerCase(), mcName ?? null],
    );
    return res.rows[0];
  }

  async createChannel(
    name: string,
    mcName?: string,
    subscribed: boolean = false,
  ): Promise<ChannelRow | null> {
    const res = await this.pool.query<ChannelRow>(
      `INSERT INTO channels (name, mc_name, subscribed)
       VALUES ($1, $2, $3)
       ON CONFLICT (name)
       DO UPDATE SET 
         mc_name = EXCLUDED.mc_name,
         subscribed = EXCLUDED.subscribed,
         updated_at = NOW()
       RETURNING *`,
      [name.toLowerCase(), mcName ?? null, subscribed],
    );
    return res.rows[0];
  }

  async getMcName(channelName: string): Promise<string | null> {
    const res = await this.pool.query<Pick<ChannelRow, 'mc_name'>>(
      `SELECT mc_name FROM channels WHERE name = $1`,
      [channelName.toLowerCase()],
    );
    if (res.rowCount === 0) return null;

    return res.rows[0].mc_name;
  }

  async getChannel(channelName: string): Promise<ChannelRow | null> {
    const res = await this.pool.query<Pick<ChannelRow, 'name'>>(
      `SELECT * FROM channels WHERE name = $1`,
      [channelName.toLowerCase()],
    );
    if (res.rowCount === 0) return null;

    // Validate & coerce the first row
    return ChannelRowSchema.parse(res.rows[0]);
  }

  async getUserFuzzy(name: string): Promise<string | null> {
    /**
     * Fuzzy search user cache using name, returning name.
     */
    const res = await this.pool.query<UserRow>(
      `
      SELECT name, similarity(name, $1) AS score
      FROM users
      ORDER BY score DESC
      LIMIT 1;
      `,
      [name],
    );

    if (res.rowCount === 0) return null;

    return UserRowSchema.parse(res.rows[0]).name;
  }

  async getTwitchFuzzy(channel: string): Promise<string | null> {
    /**
     * Fuzzy search twitch cache using channel, returning name.
     */
    const res = await this.pool.query<TwitchRow>(
      `
      SELECT channel, name, similarity(channel, $1) AS score
      FROM twitches
      ORDER BY score DESC
      LIMIT 1;
      `,
      [channel],
    );

    if (res.rowCount === 0) return null;

    return TwitchRowSchema.parse(res.rows[0]).name;
  }

  async getAllChannels(): Promise<
    Pick<ChannelRow, 'name' | 'mc_name' | 'subscribed'>[]
  > {
    const res = await this.pool.query<
      Pick<ChannelRow, 'name' | 'mc_name' | 'subscribed'>
    >(
      `SELECT name, mc_name, subscribed  FROM channels ORDER BY created_at ASC`,
    );
    return res.rows;
  }

  async listSubscribedChannels(): Promise<string[]> {
    const res = await this.pool.query<Pick<ChannelRow, 'name'>>(
      `SELECT name FROM channels WHERE subscribed = true ORDER BY created_at ASC`,
    );
    return res.rows.map((r) => r.name);
  }

  async updateSubscription(
    channelName: string,
    subscribed: boolean,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE channels SET subscribed = $1 WHERE name = $2`,
      [subscribed, channelName.toLowerCase()],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async removeChannel(name: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM channels WHERE name = $1`, [
      name.toLowerCase(),
    ]);

    return (res.rowCount ?? 0) > 0;
  }

  async upsertUser(user: string): Promise<string> {
    const res = await this.pool.query<UserRow>(
      `INSERT INTO users (name, updated_at)
        VALUES ($1, NOW())
        ON CONFLICT (name) DO UPDATE
        SET updated_at = NOW()
        RETURNING *`,
      [user],
    );
    return res.rows[0].name;
  }

  async upsertTwitch(user: string, twitch: string): Promise<string> {
    const res = await this.pool.query<TwitchRow>(
      `INSERT INTO twitches (channel, name, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (channel) DO UPDATE
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING *;
        `,
      [user, twitch],
    );
    return res.rows[0].name;
  }

  async close() {
    await this.pool.end();
  }
}
