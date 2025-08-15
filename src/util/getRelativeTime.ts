export function getRelativeTime(seconds: number): string {
  const units = [
    { label: 'y', value: 60 * 60 * 24 * 365 },
    { label: 'mo', value: 60 * 60 * 24 * 30 },
    { label: 'd', value: 60 * 60 * 24 },
    { label: 'h', value: 60 * 60 },
    { label: 'm', value: 60 },
  ];

  let remaining = seconds;
  const parts: string[] = [];

  for (const unit of units) {
    const amount = Math.floor(remaining / unit.value);
    if (amount > 0) {
      parts.push(`${amount}${unit.label}`);
      remaining -= amount * unit.value;
    }
  }

  // If no units matched, show "0m"
  if (parts.length === 0) {
    parts.push('0m');
  }

  return parts.join(' ');
}

export function getRelativeTimeFromTimestamp(timestampSeconds: number): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const elapsedSeconds = nowSeconds - timestampSeconds;
  return getRelativeTime(elapsedSeconds);
}
