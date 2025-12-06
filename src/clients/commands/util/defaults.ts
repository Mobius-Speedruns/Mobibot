import { SendMessage } from '../../../types/twitch';

export const PLAYER_NOT_FOUND = (channel: string): SendMessage => {
  return {
    channel,
    message: 'Player not found',
  };
};
