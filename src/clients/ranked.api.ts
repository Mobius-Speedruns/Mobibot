import axios, { AxiosError, AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import {
  ErrorResponse,
  GetUserDataResponse,
  GetUserDataResponseSchema,
  MatchesResponse,
  MatchesResponseSchema,
  PLAYER_NOT_FOUND_MESSAGES,
} from '../types/ranked';

export class RankedClient {
  private api: AxiosInstance;
  private logger: PinoLogger;

  constructor(baseURL: string, logger: PinoLogger) {
    this.api = axios.create({ baseURL, timeout: 10000 });
    this.logger = logger.child({ Service: Service.RANKED });

    // Intercept player not found errors
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: unknown) => {
        if (error instanceof AxiosError) {
          const responseData = error.response?.data as
            | ErrorResponse
            | undefined;

          if (
            responseData &&
            responseData.status === 'error' &&
            PLAYER_NOT_FOUND_MESSAGES.includes(responseData.data)
          ) {
            this.logger.error(responseData.data);
            throw new Error('Player not found.');
          }

          this.logger.error(error);
          throw error;
        } else {
          throw error;
        }
      },
    );
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
    const { data } = await this.api.get<GetUserDataResponse>(`/users/${name}`);

    const parsedData = GetUserDataResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getRecentMatches(name: string): Promise<MatchesResponse> {
    const { data } = await this.api.get<MatchesResponse>(
      `/users/${name}/matches`,
    );
    const parsedData = MatchesResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getRecentMatches');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getVersusData(name1: string, name2: string): Promise<MatchesResponse> {
    const { data } = await this.api.get<MatchesResponse>(
      `/users/${name1}/versus/${name2}/matches`,
    );
    const parsedData = MatchesResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getVersusData');
      throw new Error('Invalid response from getVersusData');
    }

    return parsedData;
  }
}
