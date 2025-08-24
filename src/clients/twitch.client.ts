import axios, { AxiosInstance } from 'axios';
import { Logger as PinoLogger } from 'pino';
import {
  AuthResponse,
  ChatMessageHandler,
  EventSubMessage,
  notificationMessage,
  RECOVERABLE_CODES,
  sessionWelcomeMessage,
  Subscriptions,
  SubscriptionsSchema,
  UserReponse,
} from '../types/twitch';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Service } from '../types/app';
import { parseError } from '../util/parseError';
import z from 'zod';

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

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout?: NodeJS.Timeout;
  private isReconnecting = false;

  constructor(logger: PinoLogger) {
    super();
    this.botId = process.env.BOT_ID || '';
    this.clientId = process.env.CLIENT_ID || '';
    this.clientSecret = process.env.CLIENT_SECRET || '';
    this.websocketURL = 'wss://eventsub.wss.twitch.tv/ws';
    this.oauthRefreshToken = process.env.REFRESH_TOKEN || '';
    this.logger = logger.child({ Service: Service.TWITCH });

    // TODO: If any environment variables are missing, throw an error.

    this.authApi = axios.create({
      baseURL: 'https://id.twitch.tv/oauth2',
      timeout: 10000,
    });
    this.api = axios.create({
      baseURL: 'https://api.twitch.tv/',
      headers: {
        'Client-Id': this.clientId,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Interceptor to inject fresh OAuth token into every request
    this.api.interceptors.request.use(async (config) => {
      const token = await this.fetchToken();
      if (!token) return config;
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
      this.logger.error(response.data, 'Failed to subscribe:');
    }
  }

  async unsubscribe(channelName: string) {
    if (!this.sessionId) {
      this.logger.error('WebSocket session not initialized yet.');
      return;
    }

    const [broadcasterUserId, currentSubs] = await Promise.all([
      this.fetchChannelId(channelName),
      this.fetchSubscriptions(),
    ]);

    const subscription = currentSubs.data.find(
      (sub) => sub.condition.broadcaster_user_id === broadcasterUserId,
    );

    try {
      const response = await this.api.delete('helix/eventsub/subscriptions', {
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
    this.logger.debug(`Sent message in ${channelName}, ${message}`);
  }

  private async fetchToken(): Promise<string | null> {
    const now = Date.now();
    // If token is still valid, return it
    if (this.oauthToken && now < this.oauthExpires - 5000) {
      return this.oauthToken;
    }
    await this.refreshAccessToken();
    return this.oauthToken;
  }

  private async refreshAccessToken(): Promise<void> {
    this.logger.info('Refreshing Twitch Token');
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.oauthRefreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await this.authApi.post<AuthResponse>(
        'token',
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;

      this.oauthToken = data.access_token;
      this.oauthRefreshToken = data.refresh_token;
      this.oauthExpires = Date.now() + data.expires_in * 1000;
    } catch (err: unknown) {
      const msg = parseError(err);
      this.logger.error(msg);
      throw new Error(`Failed to refresh Twitch token`);
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

  private isSessionWelcome(
    msg: EventSubMessage,
  ): msg is z.infer<typeof sessionWelcomeMessage> {
    return msg.metadata.message_type === 'session_welcome';
  }

  private isNotification(
    msg: EventSubMessage,
  ): msg is z.infer<typeof notificationMessage> {
    return msg.metadata.message_type === 'notification';
  }

  private handleWebSocketMessage(message: EventSubMessage) {
    this.logger.debug(message.metadata.message_type);
    // Initial connection
    if (this.isSessionWelcome(message)) {
      this.sessionId = message.payload.session.id;
      this.logger.info(`WebSocket session initialized: ${this.sessionId}`);
      if (this.readyResolve) this.readyResolve(); // Resolve connect()
      return;
    }

    // Incoming chat messages
    if (this.isNotification(message)) {
      if (message.metadata.subscription_type === 'channel.chat.message') {
        const event = message.payload.event;

        // Forward the message to the handler if registered
        if (this.messageHandler) {
          this.messageHandler(
            event.broadcaster_user_login,
            { username: event.chatter_user_login },
            event.message.text,
          );
        }
      }
      return;
    }

    if (message.metadata.message_type === 'session_keepalive') return;
    // Log this entire message - don't know how to handle it
    this.logger.debug(message, 'Unhandled Message');
    return;
  }

  private startWebSocket() {
    this.websocket = new WebSocket(this.websocketURL);

    this.websocket.on('open', () => {
      this.logger.info('Connected to Twitch EventSub WebSocket');
    });

    this.websocket.on('message', (data: WebSocket.RawData) =>
      // Cant be bothered figuring this out for typescript
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string
      this.handleWebSocketMessage(JSON.parse(data.toString())),
    );

    // Bubble up errors instead of just logging
    this.websocket.on('error', (error: unknown) => {
      const msg = parseError(error);
      this.logger.error({ msg }, 'WebSocket error');
      this.emit('error', new Error(`Twitch WebSocket error: ${msg}`));
    });

    // Handle WebSocket close/disconnect
    this.websocket.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'No reason provided';

      if (this.isReconnecting) {
        // Already handling reconnection, don't trigger another
        return;
      }

      if (this.isRecoverableError(code)) {
        this.logger.warn(
          `WebSocket disconnected (recoverable) with code ${code}, reason: ${reasonStr}`,
        );
        this.logger.info('Attempting automatic reconnection...');

        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }

        // Start reconnection process
        this.reconnect();
      } else {
        this.logger.error(
          `WebSocket closed with code ${code}, reason: ${reasonStr}`,
        );
        this.emit(
          'error',
          new Error(`Twitch WebSocket closed with code ${code}: ${reasonStr}`),
        );
      }
    });

    // Handle unexpected response
    this.websocket.on('unexpected-response', (request, response) => {
      this.logger.error(
        `WebSocket unexpected response: ${response.statusCode}`,
      );
      this.emit(
        'error',
        new Error(
          `Twitch WebSocket unexpected response: ${response.statusCode}`,
        ),
      );
    });
  }

  private async fetchChannelId(channelName: string): Promise<string> {
    const response = await this.api.get<UserReponse>('helix/users', {
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

  private async fetchSubscriptions(): Promise<Subscriptions> {
    const { data } = await this.api.get<Subscriptions>(
      'helix/eventsub/subscriptions',
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
    return data;
  }

  private reconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Stop trying reconnects
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.logger.error(
        `Failed to reconnect after ${this.maxReconnectAttempts} attempts. Giving up.`,
      );
      this.isReconnecting = false;
      this.emit(
        'error',
        new Error(
          `WebSocket reconnection failed after ${this.maxReconnectAttempts} attempts`,
        ),
      );
      return;
    }

    // Exponential backoff for reconnection attempts
    const delay = Math.min(
      30000,
      Math.pow(2, this.reconnectAttempts - 1) * 1000,
    ); // 1s, 2s, 4s, 8s, 16s, 30s
    this.logger.warn(
      `Attempting to reconnect in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      void (async () => {
        try {
          this.logger.info(
            `Reconnecting to Twitch WebSocket (attempt ${this.reconnectAttempts})`,
          );

          // Clean up existing websocket
          if (this.websocket) {
            this.websocket.removeAllListeners();
            if (this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.close();
            }
          }

          // Re-validate auth and start new websocket
          await this.validateAuth();
          this.startWebSocket();

          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.logger.info('Successfully reconnected to Twitch WebSocket');
        } catch (error: unknown) {
          this.logger.error(
            { msg: parseError(error) },
            'Reconnection attempt failed:',
          );
          this.isReconnecting = false;
          // Try again (will increment reconnectAttempts)
          this.reconnect();
        }
      })();
    }, delay);
  }

  private isRecoverableError(code: number): boolean {
    return RECOVERABLE_CODES.includes(code);
  }
}
