// src/clients/PacemanClient.ts
import axios, { AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import {
  Session,
  sessionSchema,
  recentRunSchema,
  Run,
  runSchema,
  NPH,
  nphSchema,
  RecentRuns,
  pbSchema,
  PB,
} from '../types/paceman';
import { Service } from '../types/app';

export class PacemanClient {
  private api: AxiosInstance;
  private logger: PinoLogger;

  constructor(baseURL: string, logger: PinoLogger) {
    this.api = axios.create({ baseURL, timeout: 10000 });
    this.logger = logger.child({ Service: Service.PACEMAN });

    // Intercept player not found errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 404) {
          throw new Error('Player not found.');
        }
        throw error;
      },
    );
  }

  async getWorld(id: number): Promise<Run> {
    this.logger.debug(`Handling /getWorld ${id}`);
    const { data } = await this.api.get('/getWorld', {
      params: {
        worldId: id,
      },
    });

    const parsedData = runSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getWorld', data);
      throw new Error('Invalid response from getWorld');
    }

    return parsedData;
  }

  async getPBs(names: string): Promise<PB> {
    this.logger.debug(`Handling /getPBs`);

    const params: Record<string, string | number> = { names };

    const { data } = await this.api.get('/getPBs', { params });

    const parsedData = pbSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getRecentRuns', data);
      throw new Error('Invalid response from getRecentRuns');
    }

    return parsedData;
  }

  async getSessionStats(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<Session> {
    this.logger.debug(`Handling /getSessionStats ${name}`);
    const params: Record<string, string | number> = { name };

    // Let paceman handle defaults if none specified
    if (hours !== undefined) params.hours = hours;
    if (hoursBetween !== undefined) params.hoursBetween = hoursBetween;

    const { data } = await this.api.get('/getSessionStats', { params });
    const parsedData = sessionSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getSessionStats', data);
      throw new Error('Invalid response from getSessionStats');
    }

    return parsedData;
  }

  async getRecentRuns(name: string, limit?: number): Promise<RecentRuns> {
    this.logger.debug(`Handling /getRecentRuns ${name}`);

    const params: Record<string, string | number> = { name };
    if (limit !== undefined) params.limit = limit;
    else params.limit = 1;

    const { data } = await this.api.get('/getRecentRuns', { params });

    const parsedData = recentRunSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getRecentRuns', data);
      throw new Error('Invalid response from getRecentRuns');
    }

    return parsedData;
  }

  async getNPH(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<NPH> {
    this.logger.debug(`Handling /getNPH ${name}`);
    const params: Record<string, string | number> = { name };

    // Let paceman handle defaults if none specified
    if (hours !== undefined) params.hours = hours;
    if (hoursBetween !== undefined) params.hoursBetween = hoursBetween;

    const { data } = await this.api.get('/getNPH', { params });

    const parsedData = nphSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getNPH', data);
      throw new Error('Invalid response from getNPH');
    }

    return parsedData;
  }
}
