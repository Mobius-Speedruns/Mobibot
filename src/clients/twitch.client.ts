import axios, { AxiosInstance } from 'axios';
import { Logger as PinoLogger } from 'pino';
import {
  AuthResponse,
  ChatMessageHandler,
  EventSubMessage,
  UserReponse,
} from '../types/twitch';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Service } from '../types/app';

export class TwitchClient extends EventEmitter {
  private authApi: AxiosInstance;
  private api: AxiosInstance;
  private messageHandler?: ChatMessageHandler;
  private logger: PinoLogger;

  private websocket?: WebSocket;
  private sessionId?: string;

  private botId: string;
  private clientId: string;
  private clientSecret: string;

  private websocketURL: string;
  private oauthRefreshToken: string;
  private oauthExpires: number = 0;
  private oauthToken: string | null = null;

  private readyPromise?: Promise<void>;
  private readyResolve?: () => void;

  constructor(logger: PinoLogger) {
    super();
    this.botId = process.env.BOT_ID || '';
    this.clientId = process.env.CLIENT_ID || '';
    this.clientSecret = process.env.CLIENT_SECRET || '';
    this.websocketURL = 'wss://eventsub.wss.twitch.tv/ws';
    this.oauthRefreshToken = process.env.REFRESH_TOKEN || '';
    this.logger = logger.child({ Service: Service.TWITCH });

    // TODO: If any environment variables are missing, throw an error.

    this.authApi = axios.create({ baseURL: 'https://id.twitch.tv/oauth2' });
    this.api = axios.create({
      baseURL: 'https://api.twitch.tv/',
      headers: {
        'Client-Id': this.clientId,
        'Content-Type': 'application/json',
      },
    });

    // Interceptor to inject fresh OAuth token into every request
    this.api.interceptors.request.use(async (config) => {
      const token = await this.fetchToken();
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });
  }

  async connect() {
    await this.validateAuth();
    this.startWebSocket();

    // Wait until the WebSocket session is ready
    return (this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    }));
  }

  // Subscribe to chat messages for a specific channel
  async subscribe(channelName: string) {
    if (!this.sessionId) {
      this.logger.error('WebSocket session not initialized yet.');
      return;
    }

    const broadcasterUserId = await this.fetchChannelId(channelName);

    const body = {
      type: 'channel.chat.message',
      version: '1',
      condition: {
        broadcaster_user_id: broadcasterUserId,
        user_id: this.botId,
      },
      transport: {
        method: 'websocket',
        session_id: this.sessionId,
      },
    };

    const response = await this.api.post('helix/eventsub/subscriptions', body);

    if (response.status !== 202) {
      this.logger.error('Failed to subscribe:', response.data);
    } else {
      this.logger.info(
        `Subscribed to channel.chat.message for broadcaster ${channelName}`,
      );
    }
  }

  async unsubscribe(channelName: string) {
    if (!this.sessionId) {
      this.logger.error('WebSocket session not initialized yet.');
      return;
    }

    const broadcasterUserId = await this.fetchChannelId(channelName);

    try {
      const response = await this.api.delete('helix/eventsub/subscriptions', {
        data: { id: broadcasterUserId },
      });

      if (response.status === 204) {
        this.logger.info(`Unsubscribed from channel ${broadcasterUserId}`);
      } else {
        this.logger.error(`Failed to unsubscribe:`, response.data);
      }
    } catch (err: any) {
      this.logger.error(
        'Error unsubscribing:',
        err.response?.data || err.message,
      );
    }
  }

  // Send messages to event handler
  onChatMessage(handler: ChatMessageHandler) {
    this.messageHandler = handler;
  }

  async send(channelName: string, message: string): Promise<void> {
    const channelId = await this.fetchChannelId(channelName);
    const response = await this.api.post('helix/chat/messages', {
      broadcaster_id: channelId,
      sender_id: this.botId,
      message,
    });

    if (response.status != 200) {
      this.logger.error(response.data, 'Failed to send chat message');
    }
    this.logger.debug(`Sent message: ${message}`);
  }

  private fetchToken() {
    const now = Date.now();
    // If token is still valid, return it
    if (this.oauthToken && now < this.oauthExpires) {
      return this.oauthToken;
    }
    return this.refreshAccessToken();
  }

  private async refreshAccessToken() {
    try {
      const response = await this.authApi.post<AuthResponse>(
        'token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.oauthRefreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;

      this.oauthToken = data.access_token;
      this.oauthRefreshToken = data.refresh_token;
      this.oauthExpires = Date.now() + data.expires_in * 1000;
    } catch (err: any) {
      this.logger.error(err.response);
      throw new Error(
        `Failed to refresh Twitch token: ${err.response?.status} ${JSON.stringify(
          err.response?.data,
        )}`,
      );
    }
  }

  private async validateAuth(): Promise<void> {
    await this.fetchToken();
    // Validate token
    const response = await this.authApi.get('validate', {
      headers: {
        Authorization: 'OAuth ' + this.oauthToken,
      },
    });

    if (response.status != 200) {
      this.logger.error(
        'Token is not valid. /oauth2/validate returned status code ' +
          response.status,
      );
      // Do nothing, await next refresh.
    }
  }

  private handleWebSocketMessage(message: EventSubMessage) {
    switch (message.metadata.message_type) {
      case 'session_welcome':
        this.sessionId = message.payload.session.id;
        this.logger.info(`WebSocket session initialized: ${this.sessionId}`);
        if (this.readyResolve) this.readyResolve(); // Resolve connect()
        break;

      case 'notification':
        if (message.metadata.subscription_type === 'channel.chat.message') {
          const event = message.payload.event;
          this.logger.debug(event, 'Incoming chat message.');

          // Forward the message to the handler if registered
          if (this.messageHandler) {
            this.messageHandler(
              event.broadcaster_user_login,
              { username: event.chatter_user_login },
              event.message.text,
            );
          }
        }
        break;
    }
  }

  private startWebSocket() {
    this.websocket = new WebSocket(this.websocketURL);

    this.websocket.on('open', () => {
      this.logger.info('Connected to Twitch EventSub WebSocket');
    });

    this.websocket.on('message', (data: WebSocket.RawData) =>
      this.handleWebSocketMessage(JSON.parse(data.toString())),
    );

    this.websocket.on('error', this.logger.error);
  }

  private async fetchChannelId(channelName: string): Promise<string> {
    const response = await this.api.get<UserReponse>('helix/users', {
      params: {
        login: channelName,
      },
    });
    if (response.data.data.length === 0)
      throw new Error('Cannot find channel.');

    return response.data.data[0].id;
  }
}
