/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
export function handleNotFound<
  T extends (this: any, ...args: any[]) => Promise<any>,
>(fn: T): T {
  return async function (this: any, ...args: any[]) {
    try {
      return await fn.apply(this, args);
    } catch (err: any) {
      if (err?.message === 'Player not found.') {
        return 'Player not found.';
      }
      throw err;
    }
  } as T;
}
