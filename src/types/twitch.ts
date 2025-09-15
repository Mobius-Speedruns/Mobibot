import z from 'zod';

export enum TwitchColor {
  Blue = 'blue',
  BlueViolet = 'blue_violet',
  CadetBlue = 'cadet_blue',
  Chocolate = 'chocolate',
  Coral = 'coral',
  DodgerBlue = 'dodger_blue',
  FireBrick = 'fire_brick',
  GoldenRod = 'golden_rod',
  Green = 'green',
  HotPink = 'hot_pink',
  OrangeRed = 'orange_red',
  Red = 'red',
  SeaGreen = 'sea_green',
  SpringGreen = 'spring_green',
  YellowGreen = 'yellow_green',
}

export const TWITCH_COLOR_HEX: Record<TwitchColor, string> = {
  [TwitchColor.Blue]: '#0000FF',
  [TwitchColor.BlueViolet]: '#8A2BE2',
  [TwitchColor.CadetBlue]: '#5F9EA0',
  [TwitchColor.Chocolate]: '#D2691E',
  [TwitchColor.Coral]: '#FF7F50',
  [TwitchColor.DodgerBlue]: '#1E90FF',
  [TwitchColor.FireBrick]: '#B22222',
  [TwitchColor.GoldenRod]: '#DAA520',
  [TwitchColor.Green]: '#008000',
  [TwitchColor.HotPink]: '#FF69B4',
  [TwitchColor.OrangeRed]: '#FF4500',
  [TwitchColor.Red]: '#FF0000',
  [TwitchColor.SeaGreen]: '#2E8B57',
  [TwitchColor.SpringGreen]: '#00FF7F',
  [TwitchColor.YellowGreen]: '#9ACD32',
};

export const DEFAULT_COLOR = TwitchColor.GoldenRod;

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.array(z.string()),
});
export const UserResponseSchema = z.object({
  data: z.array(
    z.object({
      broadcaster_type: z.string(),
      id: z.string(),
      login: z.string(),
    }),
  ),
});
export const SubscriptionsSchema = z.object({
  data: z.array(
    z.object({
      condition: z.object({
        broadcaster_user_id: z.string(),
      }),
      id: z.string(),
    }),
  ),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type Subscriptions = z.infer<typeof SubscriptionsSchema>;
export interface TwitchMessage {
  broadcaster: string;
  text: string;
  user: string;
}

export type UserReponse = z.infer<typeof UserResponseSchema>;

export const chatEventPayload = z.object({
  event: z.object({
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    chatter_user_id: z.string(),
    chatter_user_login: z.string(),
    chatter_user_name: z.string(),
    message: z.object({
      text: z.string(),
    }),
    message_type: z.string(),
  }),
});

export const sessionWelcomeEventPayload = z.object({
  session: z.object({
    connected_at: z.string(),
    id: z.string(),
    keepalive_timeout_seconds: z.number(),
    status: z.string(),
  }),
});

const baseMetadata = z.object({
  message_id: z.string(),
  message_timestamp: z.string(),
  message_type: z.string(),
  subscription_type: z.string().optional(),
});

export const notificationMessage = z.object({
  metadata: baseMetadata.extend({
    message_type: z.literal('notification'),
    subscription_type: z.literal('channel.chat.message'),
  }),
  payload: chatEventPayload,
});

export const sessionWelcomeMessage = z.object({
  metadata: baseMetadata.extend({
    message_type: z.literal('session_welcome'),
  }),
  payload: sessionWelcomeEventPayload,
});

export const sessionReconnectMessage = z.object({
  metadata: baseMetadata.extend({
    message_type: z.literal('session_reconnect'),
  }),
  payload: z.object({
    session: z.object({
      connected_at: z.string(),
      id: z.string(),
      keepalive_timeout_seconds: z.number(),
      reconnect_url: z.string(),
      status: z.string(),
    }),
  }),
});

export const sessionKeepAlive = z.object({
  metadata: baseMetadata.extend({
    message_type: z.literal('session_keepalive'),
  }),
});

export const eventSubMessage = z.union([
  notificationMessage,
  sessionWelcomeMessage,
  sessionKeepAlive,
  sessionReconnectMessage,
]);
export type ChatMessageHandler = (
  channel: string,
  tags: ChatTags,
  message: string,
) => void;

export interface ChatTags {
  username?: string;
}

export type EventSubMessage = z.infer<typeof eventSubMessage>;

export const RECOVERABLE_CODES = [
  1006, // Abnormal closure (network issues)
  4003, // Connection unused (Twitch-specific)
];

export const twitchColorResponseSchema = z.object({
  data: z.array(
    z.object({
      color: z.string(),
      user_id: z.string(),
    }),
  ),
});

export type TwitchColorResponse = z.infer<typeof twitchColorResponseSchema>;
