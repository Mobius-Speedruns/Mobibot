export function appendInvisibleChars(str: string): string {
  // TODO: find a nice way to do this with twitch sanitising.
  const invisibleSeq = '󠀀';
  return str + invisibleSeq;
}
