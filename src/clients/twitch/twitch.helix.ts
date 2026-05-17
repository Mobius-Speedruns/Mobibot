import { config } from 'src/config';
import { TwitchAuthClient } from './twitch.auth';
import { Logger } from 'pino';
import { pinoLogger } from 'src/logger/logger.client';
import axios, { AxiosInstance } from 'axios';
import {
  Subscriptions,
  SubscriptionsSchema,
  UserReponse,
} from './twitch.types';

/**
 * HTTP client for the Twitch Helix REST API.
 *
 * Provides a typed interface for managing EventSub subscriptions over a
 * WebSocket transport. Automatically injects a valid OAuth2 bearer token into
 * every request via an axios interceptor, delegating token refresh to
 * {@link TwitchAuthClient}.
 *
 * @example
 * const auth = new TwitchAuthClient();
 * const helix = new TwitchHelixApi(auth);
 * await helix.subscribe('somechannel', websocket.sessionId);
 */
export class TwitchHelixApi {
  private logger: Logger;
  private authoriser: TwitchAuthClient;
  private api: AxiosInstance;

  private BOT_ID: string = config.twitch.botId;
  private CLIENT_ID: string = config.twitch.clientId;

  constructor(authoriser: TwitchAuthClient) {
    this.authoriser = authoriser;
    this.logger = pinoLogger.child({ service: 'Twitch Helix' });

    this.api = axios.create({
      baseURL: 'https://api.twitch.tv/helix/',
      headers: {
        'Client-Id': this.CLIENT_ID,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.api.interceptors.request.use(async (config) => {
      const token = await this.authoriser.auth();
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
  }

  async send(
    channelName: string,
    message: string,
    color?: string,
  ): Promise<void> {
    if (!message) return;
    const channelId = await this._getChannelId(channelName);

    const response = await this.api.post('chat/messages', {
      broadcaster_id: channelId,
      color: color,
      message: message,
      sender_id: this.BOT_ID,
    });

    if (response.status != 200) {
      this.logger.error(response.data, 'Failed to send chat message');
    }
    this.logger.debug(`Sent message in ${channelName}, ${message}`);
  }

  async subscribe(channelName: string, sessionId?: string) {
    if (!sessionId) {
      this.logger.error('WebSocket session not initialized yet.');
      return;
    }

    const broadcasterUserId = await this._getChannelId(channelName);

    const body = {
      condition: {
        broadcaster_user_id: broadcasterUserId,
        user_id: this.BOT_ID,
      },
      transport: {
        method: 'websocket',
        session_id: sessionId,
      },
      type: 'channel.chat.message',
      version: '1',
    };

    const response = await this.api.post('eventsub/subscriptions', body);

    if (response.status === 202) {
      this.logger.debug(`Successfully subscribed to channel ${channelName}`);
    } else {
      this.logger.warn(response.data, `Failed to subscribe to ${channelName}:`);
    }
  }

  async unsubscribe(channelName: string) {
    const [broadcasterUserId, currentSubs] = await Promise.all([
      this._getChannelId(channelName),
      this._getSubscriptions(),
    ]);

    const subscription = currentSubs.data.find(
      (sub) => sub.condition.broadcaster_user_id === broadcasterUserId,
    );

    try {
      const response = await this.api.delete('eventsub/subscriptions', {
        params: { id: subscription?.id },
      });
      if (response.status === 204) {
        this.logger.info(`Unsubscribed from channel ${channelName}`);
      } else {
        this.logger.error(response.data, `Failed to unsubscribe:`);
      }
    } catch (err: unknown) {
      this.logger.error(err, 'Error unsubscribing:');
    }
  }

  private async _getChannelId(channelName: string) {
    const response = await this.api.get<UserReponse>('users', {
      params: {
        login: channelName,
      },
    });
    if (response.data.data.length === 0) {
      this.logger.error(response, 'Response from fetchChannelId');
      throw new Error('Cannot find channel.');
    }

    return response.data.data[0].id;
  }
  private async _getSubscriptions() {
    const { data } = await this.api.get<Subscriptions>(
      'eventsub/subscriptions',
      {
        params: {
          status: 'enabled',
        },
      },
    );
    const parsedData = SubscriptionsSchema.parse(data);
    if (!parsedData) {
      this.logger.error(data, 'Invalid response from fetchSubscriptions');
      throw new Error('Invalid response from fetchSubscriptions');
    }
    return parsedData;
  }
}
