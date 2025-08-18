import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';

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
    this.logger.debug(sql);
    await this.pool.query(sql);
  }

  async upsertChannel(name: string, mcName?: string) {
    const res = await this.pool.query(
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

  async getMcName(name: string) {
    const res = await this.pool.query(
      `SELECT mc_name FROM channels WHERE name = $1`,
      [name.toLowerCase()],
    );
    return res.rows[0]?.mc_name ?? null;
  }

  async listChannels(): Promise<string[]> {
    const res = await this.pool.query(
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

  async close() {
    await this.pool.end();
  }
}
