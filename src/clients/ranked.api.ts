import axios, { AxiosError, AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import {
  BOUNDS,
  ErrorResponse,
  GetUserDataResponse,
  GetUserDataResponseSchema,
  LABELS,
  MatchesResponse,
  MatchesResponseSchema,
  PLAYER_NOT_FOUND_MESSAGES,
  VSResponse,
  VSResponseSchema,
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

  convertToRank(elo: number | null): string {
    if (!elo) return 'Unranked';
    const idx = BOUNDS.findIndex((b) => elo < b);
    return LABELS[idx];
  }

  async getUserData(name: string): Promise<GetUserDataResponse> {
    this.logger.debug(`Handling /users/${name}`);
    const { data } = await this.api.get<GetUserDataResponse>(`/users/${name}`);

    const parsedData = GetUserDataResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getRecentMatches(name: string): Promise<MatchesResponse> {
    this.logger.debug(`Handling /users/${name}/matches`);

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

  async getVersusData(name1: string, name2: string): Promise<VSResponse> {
    this.logger.debug(`Handling /users/${name1}/versus/${name2}`);

    const response = await this.api.get<VSResponse>(
      `/users/${name1}/versus/${name2}`,
    );
    const parsedData = VSResponseSchema.parse(response.data);
    if (!parsedData) {
      this.logger.error({ parsedData }, 'Invalid response from getVersusData');
      throw new Error('Invalid response from getVersusData');
    }

    return parsedData;
  }

  async getAllMatches(name: string): Promise<MatchesResponse['data']> {
    this.logger.debug(`Handling getAllMatches ${name}`);

    let all: MatchesResponse['data'] = [];
    let cursor: number | undefined = undefined;
    let moreRunsAvailable = true;

    while (moreRunsAvailable) {
      const params: Record<string, string | number> = {
        count: 100,
        sort: 'newest',
      };
      if (cursor !== undefined) params.before = cursor;

      const { data } = await this.api.get<MatchesResponse>(
        `/users/${name}/matches`,
        { params },
      );

      const parsedData = MatchesResponseSchema.parse(data);
      if (!parsedData) {
        this.logger.error(data, 'Invalid response from getAllMatches');
        throw new Error('Invalid response from getAllMatches');
      }

      const matches = parsedData.data;
      if (!matches || matches.length === 0) {
        moreRunsAvailable = false;
      } else {
        all = all.concat(matches);
        cursor = matches[matches.length - 1].id; // last match ID
      }
    }

    return all;
  }
}
