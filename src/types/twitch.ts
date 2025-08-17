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

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type UserReponse = z.infer<typeof UserResponseSchema>;

export interface TwitchMessage {
  broadcaster: string;
  user: string;
  text: string;
}

export interface EventSubMessage {
  metadata: {
    message_type: string;
    subscription_type?: string;
  };
  payload: any;
}

export type ChatMessageHandler = (
  channel: string,
  tags: any,
  message: string,
) => void;
