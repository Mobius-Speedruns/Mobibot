import axios, { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'pino';
import { applyInterceptors } from 'src/common/axios.interceptors';
import { PlayerNotFound } from 'src/common/errors';
import { pinoLogger } from 'src/logger/logger.client';
import {
  ErrorResponse,
  PLAYER_NOT_FOUND_MESSAGES,
  BOUNDS,
  LABELS,
  MatchesResponse,
  MatchesResponseSchema,
  LeaderboardResponse,
  LeaderboardResponseSchema,
  RANK_COLOR,
  GetUserDataResponse,
  GetUserDataResponseSchema,
  VSResponse,
  VSResponseSchema,
} from 'src/types/ranked';

export class RankedClient {
  private api: AxiosInstance;
  private logger: Logger;

  constructor(baseURL: string) {
    this.api = axios.create({ baseURL, timeout: 30000 });
    this.logger = pinoLogger.child({ Service: 'Ranked' });

    applyInterceptors(this.api, this.logger);

    // Ranked doesnt return 404 for bad player names - instead returns 400
    this.api.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (error instanceof AxiosError && error.response?.status === 404) {
          const responseData = error.response.data as ErrorResponse | undefined;

          if (
            responseData?.status === 'error' &&
            PLAYER_NOT_FOUND_MESSAGES.includes(responseData.data)
          ) {
            this.logger.warn({ data: responseData }, 'Player not found');
            throw new PlayerNotFound();
          }
        }

        throw error;
      },
    );
  }

  convertToRank(elo: null | number): string {
    if (!elo) return 'Unranked';
    const idx = BOUNDS.findIndex((b) => elo < b);
    return LABELS[idx];
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
      const params: Record<string, number | string> = {
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

  async getCurrentSeason(): Promise<number | undefined> {
    this.logger.debug(`Handling /getCurrentSeason`);

    const { data } = await this.api.get<LeaderboardResponse>(`/leaderboard`);

    const parsedData = LeaderboardResponseSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from getUserData');
      throw new Error('Invalid response from getUserData');
    }

    return parsedData.data.season.number;
  }

  async getLeaderboard(season?: number): Promise<LeaderboardResponse> {
    this.logger.debug(`Handling /leaderboard`);

    const params: Record<string, number | string> = {};
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

  getRankColor(elo: null | number): string | undefined {
    const label = this.convertToRank(elo);
    if (label === 'Unranked') return undefined;

    const rank = label.split(' ')[0] as keyof typeof RANK_COLOR;

    return RANK_COLOR[rank];
  }

  async getRecentMatches(
    name: string,
    season?: null | number,
  ): Promise<MatchesResponse> {
    this.logger.debug(`Handling /users/${name}/matches, season: ${season}`);

    const params: Record<string, number | string> = {};
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

  async getUserData(
    name: string,
    season?: null | number,
  ): Promise<GetUserDataResponse> {
    this.logger.debug(`Handling /users/${name}, season: ${season}`);

    const params: Record<string, number | string> = {};
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

  async getVersusData(
    name1: string,
    name2: string,
    season?: null | number,
  ): Promise<VSResponse> {
    this.logger.debug(
      `Handling /users/${name1}/versus/${name2}, season: ${season}`,
    );

    const params: Record<string, number | string> = {};
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
}
