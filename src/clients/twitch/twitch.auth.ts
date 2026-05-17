import axios, { type AxiosInstance } from 'axios';
import type { Logger as PinoLogger } from 'pino';
import { AuthResponse } from './twitch.types';
import { pinoLogger } from 'src/logger/logger.client';
import { config } from 'src/config';

/**
 * Manages Twitch OAuth2 authentication via the refresh token grant flow.
 *
 * Maintains a cached access token and refreshes it automatically when it is
 * within 5 seconds of expiry. Consumers should call {@link auth} before every
 * API request rather than caching the token themselves — repeated calls are
 * cheap when the token is still valid.
 *
 * @example
 * const auth = new TwitchAuthClient();
 * const token = await auth.auth();
 * // use token in Authorization header
 */
export class TwitchAuthClient {
  private logger: PinoLogger;

  private clientId: string;
  private clientSecret: string;

  private expiresAt: number = 0;
  private refreshToken: string;
  private token: null | string = null;
  readonly client: AxiosInstance;

  constructor() {
    this.clientId = config.twitch.clientId;
    this.clientSecret = config.twitch.clientSecret;
    this.refreshToken = config.twitch.refreshToken;

    this.client = axios.create({
      baseURL: 'https://id.twitch.tv/oauth2',
      timeout: 30000,
    });
    this.logger = pinoLogger.child({ service: 'Twitch Auth' });
  }

  async auth(): Promise<null | string> {
    const now = Date.now();
    // If token is still valid, return it
    if (this.token && now < this.expiresAt - 5000) {
      return this.token;
    }

    const { access_token, refresh_token, expires } =
      await this.refreshAccessToken(this.refreshToken);

    this.token = access_token;
    this.refreshToken = refresh_token;
    this.expiresAt = expires;
    return this.token;
  }

  private async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires: number;
    refresh_token: string;
  }> {
    this.logger.info('Refreshing Twitch Token');
    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await this.client.post<AuthResponse>(
        'token',
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;

      return {
        access_token: data.access_token,
        expires: Date.now() + data.expires_in * 1000,
        refresh_token: data.refresh_token,
      };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          {
            status: err.response?.status,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: err.response?.data,
          },
          'Token refresh failed',
        );
      }
      throw new Error(`Failed to refresh Twitch token`, { cause: err });
    }
  }
}
