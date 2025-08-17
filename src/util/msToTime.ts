export function msToTime(ms: number): string {
  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;

  // Pad hours/minutes/seconds with leading zeros
  let hourStr = String(hours).padStart(2, '0');
  let minStr = String(minutes).padStart(2, '0');
  let secStr = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hourStr}:${minStr}:${secStr}` : `${minStr}:${secStr}`;
}
