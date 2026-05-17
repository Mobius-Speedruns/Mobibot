import { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'pino';
import { ClientTimeout, PlayerNotFound } from './errors';

export function applyInterceptors(api: AxiosInstance, logger: Logger): void {
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (!(error instanceof AxiosError)) {
        logger.error({ err: error }, 'Non-Axios error');
        throw error;
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
        logger.warn('Request timed out');
        throw new ClientTimeout();
      }

      if (error.response?.status === 404) {
        logger.warn({ data: error.response.data }, 'Resource not found');
        throw new PlayerNotFound();
      }

      logger.error({ err: error }, 'API error');
      throw error;
    },
  );
}
