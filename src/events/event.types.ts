import { NotificationMessage } from 'src/clients/twitch/twitch.types';

export enum TwitchEventNames {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECT = 'reconnect',
  CHAT = 'chat',
}

export type TwitchEvents = {
  [TwitchEventNames.CONNECTED]: void;
  [TwitchEventNames.DISCONNECTED]: void;
  [TwitchEventNames.RECONNECT]: void;
  [TwitchEventNames.CHAT]: NotificationMessage;
};
