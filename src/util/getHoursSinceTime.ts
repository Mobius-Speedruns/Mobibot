export function getHoursSinceTime(epoch: number): number {
  const now = Date.now();
  const diffMs = now - epoch * 1000;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.ceil(diffHours);
}
