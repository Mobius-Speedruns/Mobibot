export function isTodayUTC(timestamp: number): boolean {
  const date = new Date(timestamp * 1000); // convert seconds -> ms
  const now = new Date();

  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}
