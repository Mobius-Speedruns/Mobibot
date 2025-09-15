// src/clients/PacemanClient.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';

import { Service } from '../types/app';
import {
  Day,
  Leaderboard,
  NPH,
  nphSchema,
  PB,
  pbSchema,
  RecentRuns,
  recentRunSchema,
  Session,
  sessionSchema,
  User,
  World,
  worldSchema,
} from '../types/paceman';

export class PacemanClient {
  private api: AxiosInstance;
  private logger: PinoLogger;

  constructor(baseURL: string, logger: PinoLogger) {
    this.api = axios.create({ baseURL, timeout: 30000 });
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

  async getAllUsers(): Promise<User[]> {
    this.logger.debug(`Handling /getAllUsers`);

    const { data } = await this.api.get<User[]>('/getAllUsers');

    return data;
  }

  async getLeaderboard(
    days: Day,
    type: string = 'fastest',
    category: string = 'finish',
  ): Promise<Leaderboard[]> {
    this.logger.debug(`Handling /getLeaderboard`);

    const params: Record<string, number | string> = { category, days, type };

    const { data } = await this.api.get<Leaderboard[]>('/getLeaderboard', {
      params,
    });

    return data;
  }

  async getNPH(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<NPH> {
    this.logger.debug(`Handling /getNPH ${name}`);
    const params: Record<string, number | string> = { name };

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

  async getPBs(names: string): Promise<PB> {
    this.logger.debug(`Handling /getPBs ${names}`);

    const params: Record<string, number | string> = { names };

    const { data } = await this.api.get<PB>('/getPBs', { params });

    const parsedData = pbSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getRecentRuns');
      throw new Error('Invalid response from getRecentRuns');
    }

    return parsedData;
  }

  async getRecentRuns(name: string, limit?: number): Promise<RecentRuns> {
    this.logger.debug(`Handling /getRecentRuns ${name}`);

    const params: Record<string, number | string> = { name };
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

  async getSessionStats(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<Session> {
    this.logger.debug(`Handling /getSessionStats ${name}`);
    const params: Record<string, number | string> = { name };

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
}
