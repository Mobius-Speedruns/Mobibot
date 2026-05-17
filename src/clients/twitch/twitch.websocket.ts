import WebSocket from 'ws';
import { config } from 'src/config';
import { eventSubMessage, EventSubMessage } from './twitch.types';
import { Logger } from 'pino';
import { pinoLogger } from 'src/logger/logger.client';
import { TypedEmitter } from 'src/eventemitter/event.emitter';
import { TwitchEvents, TwitchEventNames } from 'src/eventemitter/event.types';

/**
 * Manages a persistent WebSocket connection to the Twitch EventSub API.
 *
 * Handles the full lifecycle of a Twitch EventSub session including initial
 * connection, session negotiation, keepalive monitoring, and server-initiated
 * reconnects. Emits typed events via {@link TypedEmitter} for downstream
 * consumers to react to chat notifications and connection state changes.
 *
 * @emits {TwitchEventNames.CONNECTED} when a session is established and ready
 * @emits {TwitchEventNames.DISCONNECTED} when the socket closes
 * @emits {TwitchEventNames.CHAT} when a channel chat notification is received
 */
export class TwitchWebsocket extends TypedEmitter<TwitchEvents> {
  private logger: Logger;
  private staleWs: WebSocket | null = null;
  private ws: WebSocket | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;

  sessionId?: string;

  EVENTSUB_WEBSOCKET_URL: string = config.twitch.eventsubWebsocketUrl;
  KEEPALIVE_TIMEOUT: number = config.twitch.keepaliveDuration + 5000;

  constructor() {
    super();
    this.logger = pinoLogger.child({ service: 'Twitch Websocket' });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.once(TwitchEventNames.CONNECTED, () => resolve());
      this.connect(this.EVENTSUB_WEBSOCKET_URL);
    });
  }
  stop() {
    this.ws?.close();
    this.ws = null;
  }

  private connect(url: string) {
    const websocket = new WebSocket(url);
    this.ws = websocket;

    websocket.on('open', () => {
      this.logger.info(
        `Connected to Twitch EventSub WebSocket: ${this.EVENTSUB_WEBSOCKET_URL}`,
      );
    });
    websocket.on('close', () => {
      this.logger.info(
        `Twitch EventSub WebSocket closed: ${this.EVENTSUB_WEBSOCKET_URL}`,
      );
      this.emit(TwitchEventNames.DISCONNECTED, undefined);
    });
    websocket.on('error', (err) => {
      this.logger.error(err);
      // TODO: attempt to reconnect here with backoff
    });
    websocket.on('message', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string
      const raw = JSON.parse(message.toString());
      const parsed = eventSubMessage.parse(raw);
      this.handle(parsed);
    });
  }

  private handle(message: EventSubMessage) {
    this.logger.debug(`Incoming eventSub message: ${JSON.stringify(message)}`);

    switch (message.metadata.message_type) {
      case 'notification': {
        this.handleKeepAlive();
        const msg = message as Extract<
          EventSubMessage,
          { metadata: { message_type: 'notification' } }
        >;
        this.logger.debug(
          `Eventsub Notification Received ${JSON.stringify(message)}`,
        );
        this.emit(TwitchEventNames.CHAT, msg);
        break;
      }
      case 'session_welcome': {
        const msg = message as Extract<
          EventSubMessage,
          { metadata: { message_type: 'session_welcome' } }
        >;

        this.logger.debug(`Websocket session ID: ${msg.payload.session.id}`);
        this.sessionId = msg.payload.session.id;
        this.staleWs?.close();
        this.emit(TwitchEventNames.CONNECTED, undefined);
        break;
      }
      case 'session_keepalive': {
        this.handleKeepAlive();
        break;
      }
      case 'session_reconnect': {
        const msg = message as Extract<
          EventSubMessage,
          { metadata: { message_type: 'session_reconnect' } }
        >;

        const reconnectUrl = msg.payload.session.reconnect_url;
        this.handleReconnect(reconnectUrl);
        break;
      }
    }
  }
  private handleKeepAlive() {
    this._clearKeepAliveTimer();
    this.keepAliveTimer = setTimeout(() => {
      this.logger.warn(
        `No session_keepalive received within ${this.KEEPALIVE_TIMEOUT}ms, reconnecting...`,
      );
      this.connect(this.EVENTSUB_WEBSOCKET_URL);
    }, this.KEEPALIVE_TIMEOUT);
  }
  private handleReconnect(reconnectUrl: string) {
    this.logger.info(`Reconnecting to: ${reconnectUrl}`);
    this.staleWs = this.ws;

    this.connect(reconnectUrl);
  }

  private _clearKeepAliveTimer() {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
