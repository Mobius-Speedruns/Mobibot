export function msToTime(ms: number, includeMs = true): string {
  ms = Math.round(ms);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  // Pad hours/minutes/seconds with leading zeros
  const hourStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');
  const msStr = String(milliseconds).padStart(3, '0');

  if (hours > 0) {
    return includeMs
      ? `${hourStr}:${minStr}:${secStr}.${msStr}`
      : `${hourStr}:${minStr}:${secStr}`;
  } else {
    return includeMs ? `${minStr}:${secStr}.${msStr}` : `${minStr}:${secStr}`;
  }
}
