import axios, { AxiosError, AxiosInstance } from 'axios';
import { type Logger as PinoLogger } from 'pino';
import { Service } from '../types/app';
import {
  BOUNDS,
  ErrorResponse,
  GetUserDataResponse,
  GetUserDataResponseSchema,
  LABELS,
  LeaderboardResponse,
  LeaderboardResponseSchema,
  MatchesResponse,
  MatchesResponseSchema,
  PLAYER_NOT_FOUND_MESSAGES,
  RANK_COLOR,
  VSResponse,
  VSResponseSchema,
} from '../types/ranked';

export class RankedClient {
  private api: AxiosInstance;
  private logger: PinoLogger;

  constructor(baseURL: string, logger: PinoLogger) {
    this.api = axios.create({ baseURL, timeout: 30000 });
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

  getRankColor(elo: number | null): string | undefined {
    const label = this.convertToRank(elo);
    if (label === 'Unranked') return undefined;

    const rank = label.split(' ')[0] as keyof typeof RANK_COLOR;

    return RANK_COLOR[rank];
  }

  async getUserData(
    name: string,
    season?: number | null,
  ): Promise<GetUserDataResponse> {
    this.logger.debug(`Handling /users/${name}, season: ${season}`);

    const params: Record<string, string | number> = {};
    if (season) params.season = season;

    const { data } = await this.api.get<GetUserDataResponse>(`/users/${name}`, {
      params,
    });

    const parsedData = GetUserDataResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getRecentMatches(
    name: string,
    season?: number | null,
  ): Promise<MatchesResponse> {
    this.logger.debug(`Handling /users/${name}/matches, season: ${season}`);

    const params: Record<string, string | number> = {};
    if (season) params.season = season;

    const { data } = await this.api.get<MatchesResponse>(
      `/users/${name}/matches`,
      { params },
    );
    const parsedData = MatchesResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getRecentMatches');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getVersusData(
    name1: string,
    name2: string,
    season?: number | null,
  ): Promise<VSResponse> {
    this.logger.debug(
      `Handling /users/${name1}/versus/${name2}, season: ${season}`,
    );

    const params: Record<string, string | number> = {};
    if (season) params.season = season;

    const response = await this.api.get<VSResponse>(
      `/users/${name1}/versus/${name2}`,
      { params },
    );
    const parsedData = VSResponseSchema.parse(response.data);
    if (!parsedData) {
      this.logger.error({ parsedData }, 'Invalid response from getVersusData');
      throw new Error('Invalid response from getVersusData');
    }

    return parsedData;
  }

  async getAllMatches(
    name: string,
    season?: number,
  ): Promise<MatchesResponse['data']> {
    this.logger.debug(`Handling getAllMatches ${name}`);

    let all: MatchesResponse['data'] = [];
    let cursor: number | undefined = undefined;
    let moreRunsAvailable = true;

    while (moreRunsAvailable) {
      const params: Record<string, string | number> = {
        count: 100,
        sort: 'newest',
      };
      if (season) params.season = season;
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

      const matches = parsedData.data.filter((match) => match.id);
      if (!matches || matches.length === 0) {
        moreRunsAvailable = false;
      } else {
        all = all.concat(matches);
        cursor = matches[matches.length - 1].id; // last match ID
      }
    }

    return all;
  }

  async getLeaderboard(season?: number): Promise<LeaderboardResponse> {
    this.logger.debug(`Handling /leaderboard`);

    const params: Record<string, string | number> = {};
    if (season) params.season = season;

    const { data } = await this.api.get<LeaderboardResponse>(`/leaderboard`, {
      params,
    });

    const parsedData = LeaderboardResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData;
  }

  async getCurrentSeason(): Promise<number> {
    this.logger.debug(`Handling /getCurrentSeason`);

    const { data } = await this.api.get<LeaderboardResponse>(`/leaderboard`);

    const parsedData = LeaderboardResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData.data.season.number;
  }
}
