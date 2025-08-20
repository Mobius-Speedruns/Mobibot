import { AxiosError } from 'axios';

export function parseError(err: unknown): string {
  if (err instanceof AxiosError) {
    return `AxiosError ${err.response?.status}: ${JSON.stringify(err.response?.data)}`;
  } else if (err instanceof Error) {
    return err.message;
  } else {
    return String(err);
  }
}
