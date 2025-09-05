import axios, { AxiosError, AxiosInstance } from 'axios';
import { Logger as PinoLogger } from 'pino';
import {
  AuthResponse,
  ChatMessageHandler,
  EventSubMessage,
  notificationMessage,
  RECOVERABLE_CODES,
  sessionReconnectMessage,
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

  // Track active subscriptions for re-establishment
  private activeChannels = new Set<string>();

  // For handling Twitch-initiated reconnects
  private reconnectWebSocket?: WebSocket;

  constructor(logger: PinoLogger) {
    super();
    this.botId = process.env.BOT_ID || '';
    this.clientId = process.env.CLIENT_ID || '';
    this.clientSecret = process.env.CLIENT_SECRET || '';
    this.websocketURL = 'wss://eventsub.wss.twitch.tv/ws';
    this.oauthRefreshToken = process.env.REFRESH_TOKEN || '';
    this.logger = logger.child({ Service: Service.TWITCH });

    this.authApi = axios.create({
      baseURL: 'https://id.twitch.tv/oauth2',
      timeout: 30000,
    });
    this.api = axios.create({
      baseURL: 'https://api.twitch.tv/',
      headers: {
        'Client-Id': this.clientId,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Interceptor to inject fresh OAuth token into every request
    this.api.interceptors.request.use(async (config) => {
      const token = await this.fetchToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });

    // Interceptors to handle errors
    const handleError = (error: AxiosError) => {
      // Ignore 429 - likely shared chat
      if (error.response?.status !== 429) {
        this.emit('apiError', error);
      }
      return Promise.reject(error);
    };

    this.authApi.interceptors.response.use((res) => res, handleError);
    this.api.interceptors.response.use((res) => res, handleError);
  }

  async connect() {
    await this.validateAuth();
    this.websocket = this.startWebSocket();

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
    this.activeChannels.add(channelName);

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

    if (response.status === 202) {
      this.logger.debug(`Successfully subscribed to channel ${channelName}`);
    } else {
      this.logger.warn(response.data, `Failed to subscribe to ${channelName}:`);
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
        this.activeChannels.delete(channelName);
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

  private isReconnectMessage(
    msg: EventSubMessage,
  ): msg is z.infer<typeof sessionReconnectMessage> {
    return msg.metadata.message_type === 'session_reconnect';
  }

  private async handleWebSocketMessage(message: EventSubMessage) {
    this.logger.debug(message.metadata.message_type);

    // Handle Twitch-initiated reconnect
    if (this.isReconnectMessage(message)) {
      this.logger.info('Received reconnect message from Twitch');
      const reconnectUrl = message.payload.session.reconnect_url; // .session?.reconnect_url;

      if (reconnectUrl) {
        this.logger.info(`Reconnecting to new URL: ${reconnectUrl}`);
        this.handleReconnect(reconnectUrl);
      } else {
        this.logger.error('Reconnect message missing reconnect_url');
      }
      return;
    }

    // Initial connection
    if (this.isSessionWelcome(message)) {
      const newSessionId = message.payload.session.id;

      // If this is a reconnect WebSocket becoming the primary
      if (this.reconnectWebSocket) {
        this.logger.info(`Switching to new WebSocket session: ${newSessionId}`);

        // Close old connection
        if (this.websocket) {
          this.websocket.removeAllListeners();
          this.websocket.close(1000);
        }

        // Make the reconnect websocket the primary
        this.websocket = this.reconnectWebSocket;
        this.reconnectWebSocket = undefined;
      }

      this.sessionId = newSessionId;
      this.logger.info(`WebSocket session initialized: ${this.sessionId}`);

      // Re-establish subscriptions for all active channels
      await this.reestablishSubscriptions();

      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = undefined;
      }
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
  }

  private handleReconnect(reconnectUrl: string): void {
    this.logger.info('Starting Twitch-initiated reconnect process');
    try {
      this.reconnectWebSocket = this.startWebSocket(reconnectUrl);
    } catch (error) {
      this.logger.error(error, 'Failed to create reconnect WebSocket');
      throw error;
    }
  }

  private async reestablishSubscriptions(): Promise<void> {
    if (this.activeChannels.size === 0) {
      this.logger.warn('No active channels to resubscribe to');
      return;
    }

    this.logger.info(
      `Re-establishing ${this.activeChannels.size} subscriptions`,
    );

    // Clear the set and re-add as we successfully subscribe
    const channelsToResubscribe = Array.from(this.activeChannels);
    this.activeChannels.clear();

    for (const channelName of channelsToResubscribe) {
      try {
        await this.subscribe(channelName);
      } catch (error) {
        this.logger.error(error, `Failed to resubscribe to ${channelName}`);
        // Don't re-add to activeChannels if subscription failed
      }
    }
  }

  private startWebSocket(url?: string): WebSocket {
    const wsUrl = url || this.websocketURL;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      this.logger.info(`Connected to Twitch EventSub WebSocket: ${wsUrl}`);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        // Cant be bothered figuring this out for typescript
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const message = JSON.parse(data.toString()) as EventSubMessage;
        void this.handleWebSocketMessage(message);
      } catch (err) {
        this.logger.error(err, 'Error parsing WebSocket message');
      }
    });

    ws.on('error', (error: unknown) => {
      this.logger.error({ error }, 'WebSocket error');
    });

    // Handle WebSocket close/disconnect
    ws.on('close', (code, reason) => {
      this.logger.debug(`Handling close ${code}`);
      if (code === 1000) {
        // Do nothing, connection closed intentionally.
        return;
      }

      const reasonStr = reason ? reason.toString() : 'No reason provided';
      this.logger.error(
        `WebSocket closed with code ${code}, reason: ${reasonStr}`,
      );
      this.handleReconnect(this.websocketURL);
    });

    return ws;
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
    return parsedData;
  }
}
