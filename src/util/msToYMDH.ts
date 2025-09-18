export function msToYMDH(ms: number): string {
  ms = Math.floor(ms);

  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30); // approx 30 days
  const years = Math.floor(months / 12);

  const remainingMonths = months % 12;
  const remainingDays = days % 30;
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];

  if (years > 0) parts.push(`${years}y`);
  if (remainingMonths > 0) parts.push(`${remainingMonths}mo`);
  if (remainingDays > 0) parts.push(`${remainingDays}d`);
  if (remainingHours > 0) parts.push(`${remainingHours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
}
