// src/clients/PacemanClient.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import {
  Session,
  sessionSchema,
  recentRunSchema,
  NPH,
  nphSchema,
  RecentRuns,
  pbSchema,
  PB,
  World,
  worldSchema,
  Day,
  Leaderboard,
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
      (error: unknown) => {
        if (error instanceof AxiosError) {
          if (error.response && error.response.status === 404) {
            throw new Error('Player not found.');
          }
        }
        throw error;
      },
    );
  }

  async getWorld(id: number): Promise<World> {
    this.logger.debug(`Handling /getWorld ${id}`);
    const { data } = await this.api.get<World>('/getWorld', {
      params: {
        worldId: id,
      },
    });

    const parsedData = worldSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getWorld');
      throw new Error('Invalid response from getWorld');
    }

    return parsedData;
  }

  async getPBs(names: string): Promise<PB> {
    this.logger.debug(`Handling /getPBs`);

    const params: Record<string, string | number> = { names };

    const { data } = await this.api.get<PB>('/getPBs', { params });

    const parsedData = pbSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getRecentRuns');
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

    const { data } = await this.api.get<Session>('/getSessionStats', {
      params,
    });
    const parsedData = sessionSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getSessionStats');
      throw new Error('Invalid response from getSessionStats');
    }

    return parsedData;
  }

  async getRecentRuns(name: string, limit?: number): Promise<RecentRuns> {
    this.logger.debug(`Handling /getRecentRuns ${name}`);

    const params: Record<string, string | number> = { name };
    if (limit !== undefined) params.limit = limit;
    else params.limit = 1;

    const { data } = await this.api.get<RecentRuns>('/getRecentRuns', {
      params,
    });

    const parsedData = recentRunSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getRecentRuns');
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

    const { data } = await this.api.get<NPH>('/getNPH', { params });

    const parsedData = nphSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getNPH');
      throw new Error('Invalid response from getNPH');
    }

    return parsedData;
  }

  async getLeaderboard(
    days: Day,
    type: string = 'fastest',
    category: string = 'finish',
  ): Promise<Leaderboard[]> {
    this.logger.debug(`Handling /getLeaderboard`);

    const params: Record<string, string | number> = { days, type, category };

    const { data } = await this.api.get<Leaderboard[]>('/getLeaderboard', {
      params,
    });

    return data;
  }
}
