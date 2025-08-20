import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import { ChannelRow, ChannelRowSchema } from '../types/postgres';

export class PostgresClient {
  private pool: Pool;
  private logger: PinoLogger;

  constructor(connectionString: string, logger: PinoLogger) {
    this.logger = logger.child({ Service: Service.DB });
    this.pool = new Pool({
      connectionString,
    });
  }

  async init() {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../migrations/001_init.sql'),
      'utf8',
    );
    await this.pool.query(sql);
  }

  async upsertChannel(
    name: string,
    mcName?: string,
  ): Promise<ChannelRow | null> {
    const res = await this.pool.query<ChannelRow>(
      `INSERT INTO channels (name, mc_name)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET mc_name = EXCLUDED.mc_name
       WHERE channels.mc_name IS DISTINCT FROM EXCLUDED.mc_name
       RETURNING *`,
      [name.toLowerCase(), mcName ?? null],
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

  async listChannels(): Promise<string[]> {
    const res = await this.pool.query<Pick<ChannelRow, 'name'>>(
      `SELECT name FROM channels ORDER BY created_at ASC`,
    );
    return res.rows.map((r) => r.name);
  }

  async removeChannel(name: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM channels WHERE name = $1`, [
      name.toLowerCase(),
    ]);

    return (res.rowCount ?? 0) > 0;
  }

  async getAllChannels(): Promise<Pick<ChannelRow, 'name' | 'mc_name'>[]> {
    const res = await this.pool.query<Pick<ChannelRow, 'name' | 'mc_name'>>(
      `SELECT name, mc_name FROM channels ORDER BY created_at ASC`,
    );
    return res.rows;
  }

  async close() {
    await this.pool.end();
  }
}
