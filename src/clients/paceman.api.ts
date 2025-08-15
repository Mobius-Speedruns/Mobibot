// src/clients/PacemanClient.ts
import axios, { AxiosInstance } from 'axios';
import {
  Session,
  sessionSchema,
  RecentRun,
  recentRunSchema,
  Run,
  runSchema,
} from '../types/paceman';

export class PacemanClient {
  private api: AxiosInstance;

  constructor(baseURL: string) {
    this.api = axios.create({ baseURL });
  }

  async getSessionStats(name: string): Promise<Session> {
    const { data } = await this.api.get('/getSessionStats', {
      params: {
        name,
      },
    });
    const parsedData = sessionSchema.parse(data);
    if (!parsedData) throw new Error('Invalid response from getSessionStats');

    return parsedData;
  }

  async getRecentRun(name: string): Promise<RecentRun> {
    const { data } = await this.api.get('/getRecentRuns', {
      params: {
        name,
        limit: 1,
      },
    });

    const parsedData = recentRunSchema.parse(data);
    if (!parsedData) throw new Error('Invalid response from getSessionStats');

    return parsedData;
  }

  async getWorld(id: number): Promise<Run> {
    const { data } = await this.api.get('/getWorld', {
      params: {
        worldId: id,
      },
    });

    const parsedData = runSchema.parse(data);
    if (!parsedData) throw new Error('Invalid response from getSessionStats');

    return parsedData;
  }
}
