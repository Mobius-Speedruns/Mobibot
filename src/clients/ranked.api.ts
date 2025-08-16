import axios, { AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import {
  GetUserDataResponse,
  GetUserDataResponseSchema,
  MatchesResponse,
  MatchesResponseSchema,
} from '../types/ranked';

export class RankedClient {
  private api: AxiosInstance;
  private logger: PinoLogger;

  constructor(baseURL: string, logger: PinoLogger) {
    this.api = axios.create({ baseURL });
    this.logger = logger.child({ Service: Service.RANKED });
  }

  convertToRank(elo: number): string {
    const BOUNDS = [
      400,
      500,
      600,
      700,
      800,
      900,
      1000,
      1100,
      1200,
      1300,
      1400,
      1500,
      1650,
      1800,
      2000,
      Infinity,
    ] as const;

    const LABELS = [
      'Coal I',
      'Coal II',
      'Coal III',
      'Iron I',
      'Iron II',
      'Iron III',
      'Gold I',
      'Gold II',
      'Gold III',
      'Emerald I',
      'Emerald II',
      'Emerald III',
      'Diamond I',
      'Diamond II',
      'Diamond III',
      'Netherite',
    ] as const;

    const idx = BOUNDS.findIndex((b) => elo < b);
    return LABELS[idx];
  }

  async getUserData(name: string): Promise<GetUserDataResponse> {
    const { data } = await this.api.get(`/users/${name}`);

    const parsedData = GetUserDataResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getUserData', data);
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getRecentMatches(name: string): Promise<MatchesResponse> {
    const { data } = await this.api.get(`/users/${name}/matches`);

    const parsedData = MatchesResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error('Invalid response from getRecentMatches', data);
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }
}
