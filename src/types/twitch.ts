import z from 'zod';

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.array(z.string()),
});
export const UserResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      login: z.string(),
      broadcaster_type: z.string(),
    }),
  ),
});
export const SubscriptionsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      condition: z.object({
        broadcaster_user_id: z.string(),
      }),
    }),
  ),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type UserReponse = z.infer<typeof UserResponseSchema>;
export type Subscriptions = z.infer<typeof SubscriptionsSchema>;

export interface TwitchMessage {
  broadcaster: string;
  user: string;
  text: string;
}

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
    id: z.string(),
    status: z.string(),
    connected_at: z.string(),
    keepalive_timeout_seconds: z.number(),
  }),
});

const baseMetadata = z.object({
  message_id: z.string(),
  message_type: z.string(),
  message_timestamp: z.string(),
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

export const eventSubMessage = z.union([
  notificationMessage,
  sessionWelcomeMessage,
]);
export type EventSubMessage = z.infer<typeof eventSubMessage>;

export interface ChatTags {
  username?: string;
}

export type ChatMessageHandler = (
  channel: string,
  tags: ChatTags,
  message: string,
) => void;
