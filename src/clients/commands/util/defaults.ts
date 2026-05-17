import { SendMessage } from 'src/clients/twitch/twitch.types';

export const PLAYER_NOT_FOUND = (channel: string): SendMessage => {
  return {
    channel,
    message: 'Player not found',
  };
};
